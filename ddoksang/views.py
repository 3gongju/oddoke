from datetime import timedelta
from django.conf import settings
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Q, F
from django.views.decorators.http import require_GET, require_POST
from django.contrib.auth.decorators import user_passes_test
from django.db import transaction
from django.forms import formset_factory

from .models import BdayCafe, BdayCafeImage, CafeFavorite, TourPlan, TourStop, UserSearchHistory
from .forms import BdayCafeForm, BdayCafeImageForm
from artist.models import Artist, Member
import json

def admin_required(view_func):
    return user_passes_test(lambda u: u.is_superuser or u.is_staff)(view_func)

@require_GET
def member_autocomplete(request):
    q = request.GET.get('q', '').strip()
    results = []

    if q:
        # distinct() 추가로 중복 제거 시도
        members = Member.objects.filter(
            Q(member_name__icontains=q)
        ).distinct().prefetch_related('artist_name')[:10]

        # 멤버마다 첫번째 아티스트 정보만 가져오기
        for member in members:
            artist_names = member.artist_name.all()
            if artist_names:
                artist_display = ' / '.join([a.display_name for a in artist_names.distinct()])
                results.append({
                    'member_id': member.id,
                    'artist_id': artist_names.first().id,
                    'member_name': member.member_name,
                    'artist_display': artist_display,
                    'bday': member.member_bday,
                })

    return JsonResponse({'results': results})

def home_view(request):
    """개선된 홈 뷰 - 더 풍성한 데이터 제공"""
    today = timezone.now().date()
    
    # 이번 주 생일 아티스트들
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    week_bdays = [(start_of_week + timedelta(days=i)).strftime('%m-%d') for i in range(7)]
    
    # 생일인 멤버들과 그들의 아티스트 정보
    birthday_members = Member.objects.filter(
        member_bday__in=week_bdays
    ).select_related().prefetch_related('artist_name')
    
    birthday_artists = []
    for member in birthday_members:
        artists = member.artist_name.all()
        if artists:
            artist = artists[0]  # 첫 번째 아티스트
            birthday_artists.append({
                'member_name': member.member_name,
                'artist_name': artist.display_name,
                'birthday_display': member.member_bday,
                'profile_image': member.profile_image if hasattr(member, 'profile_image') else None,
            })
    
    # 추천 생일카페들 (featured)
    featured_cafes = BdayCafe.objects.filter(
        status='approved',
        is_featured=True
    ).select_related('artist', 'member').order_by('-created_at')[:8]
    
    # 최신 생일카페들
    recent_cafes = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member').order_by('-created_at')[:6]
    
    # 지도용 생일카페 데이터
    active_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member')
    
    cafes_json = json.dumps([cafe.get_kakao_map_data() for cafe in active_cafes])
    
    # 사용자 찜 목록 (로그인한 경우)
    user_favorites = []
    if request.user.is_authenticated:
        user_favorites = list(CafeFavorite.objects.filter(
            user=request.user
        ).values_list('cafe_id', flat=True))

    context = {
        'birthday_artists': birthday_artists,
        'featured_cafes': featured_cafes,
        'recent_cafes': recent_cafes,
        'cafes_json': cafes_json,
        'total_cafes': active_cafes.count(),
        'user_favorites': user_favorites,
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/home.html', context)

def bday_cafe_create(request):
    context = {
        "kakao_api_key": settings.KAKAO_MAP_API_KEY,  # settings.py에 정의된 변수명과 맞추세요
    }
    return render(request, "ddoksang/create.html", context)

def map_view(request):
    active_bday_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=timezone.now().date(),
        end_date__gte=timezone.now().date()
    ).select_related('artist', 'member')

    bday_cafe_data = [b.get_kakao_map_data() for b in active_bday_cafes]

    context = {
        'bday_cafes_json': json.dumps(bday_cafe_data),
        'total_bday_cafes': len(bday_cafe_data),
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/tour_map.html', context)

@login_required
def create_cafe(request):
    if request.method == 'POST':
        post_data = request.POST.copy()

        # artist_id → artist 객체 pk 변경
        artist_id = post_data.get('artist_id')
        try:
            artist = Artist.objects.get(id=artist_id)
            post_data['artist'] = artist.id
        except Artist.DoesNotExist:
            messages.error(request, "유효하지 않은 아티스트입니다.")
            return redirect('ddoksang:create')

        # member_id → member 객체 pk 변경 (선택적)
        member_id = post_data.get('member_id')
        if member_id:
            try:
                member = Member.objects.get(id=member_id)
                post_data['member'] = member.id
            except Member.DoesNotExist:
                post_data['member'] = None
        else:
            post_data['member'] = None

        form = BdayCafeForm(post_data, request.FILES)
        image_form = BdayCafeImageForm(request.POST, request.FILES)

        if form.is_valid() and image_form.is_valid():
            try:
                with transaction.atomic():
                    cafe = form.save(commit=False)
                    cafe.submitted_by = request.user
                    cafe.status = 'pending'
                    cafe.save()

                    # 다중 이미지 저장
                    images = request.FILES.getlist('images')
                    for idx, image_file in enumerate(images):
                        BdayCafeImage.objects.create(
                            cafe=cafe,
                            image=image_file,
                            order=idx,
                        )

                    messages.success(request, "생일카페가 성공적으로 등록되었습니다.")
                    return redirect('ddoksang:my_cafes')

            except Exception as e:
                messages.error(request, f"등록 중 오류가 발생했습니다: {str(e)}")
        else:
            messages.error(request, f"폼 오류: {form.errors} {image_form.errors}")
    else:
        form = BdayCafeForm()
        image_form = BdayCafeImageForm()

    context = {
        'form': form,
        'image_form': image_form,
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/create.html', context)

@login_required
def my_cafes(request):
    cafes = BdayCafe.objects.filter(
        submitted_by=request.user
    ).select_related('artist', 'member').order_by('-created_at')
    return render(request, 'ddoksang/my_cafes.html', {'cafes': cafes})

def bday_cafe_detail(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id, status='approved')
    is_favorited = False
    
    if request.user.is_authenticated:
        is_favorited = CafeFavorite.objects.filter(user=request.user, cafe=cafe).exists()
        # 조회수 증가
        BdayCafe.objects.filter(id=cafe_id).update(view_count=F('view_count') + 1)
    
    context = {
        'cafe': cafe,
        'is_favorited': is_favorited,
    }
    return render(request, 'ddoksang/detail.html', context)

def bday_cafe_list_api(request):
    cafes = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member').order_by('-start_date')

    data = []
    for cafe in cafes:
        data.append({
            'id': cafe.id,
            'name': cafe.cafe_name,
            'artist': cafe.artist.display_name,
            'member': cafe.member.member_name if cafe.member else None,
            'latitude': float(cafe.latitude),
            'longitude': float(cafe.longitude),
            'start_date': cafe.start_date.strftime('%Y-%m-%d'),
            'end_date': cafe.end_date.strftime('%Y-%m-%d'),
            'main_image': cafe.main_image.url if cafe.main_image else None,
        })

    return JsonResponse({'success': True, 'bday_cafes': data, 'total': len(data)})

@login_required
@require_POST
def toggle_favorite(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    favorite, created = CafeFavorite.objects.get_or_create(user=request.user, cafe=cafe)

    if not created:
        favorite.delete()
        is_favorited = False
    else:
        is_favorited = True

    return JsonResponse({'is_favorited': is_favorited})

def search_view(request):
    query = request.GET.get("q", "").strip()
    results = []
    
    # 검색 기록 저장 (로그인한 사용자만)
    if request.user.is_authenticated and query:
        UserSearchHistory.objects.create(
            user=request.user,
            search_query=query,
            search_type='keyword'
        )

    if query:
        # 더 정확한 검색을 위한 다양한 필터링
        results = BdayCafe.objects.filter(
            Q(cafe_name__icontains=query) |
            Q(artist__display_name__icontains=query) |
            Q(member__member_name__icontains=query) |
            Q(address__icontains=query) |
            Q(hashtags__icontains=query),
            status='approved'
        ).select_related('artist', 'member').distinct().order_by('-created_at')

    context = {
        "query": query,
        "results": results,
        "total_count": results.count() if results else 0,
    }
    return render(request, "ddoksang/search_results.html", context)


# 관리자 뷰들
@admin_required
def admin_dashboard(request):
    # 승인 상태별 카운트
    stats = {
        'pending': BdayCafe.objects.filter(status='pending').count(),
        'approved': BdayCafe.objects.filter(status='approved').count(),
        'rejected': BdayCafe.objects.filter(status='rejected').count(),
        'total': BdayCafe.objects.all().count(),
        'this_month': BdayCafe.objects.filter(
            created_at__month=timezone.now().month,
            created_at__year=timezone.now().year
        ).count(),
    }

    # 최근 등록된 생카 5개
    recent_cafes = BdayCafe.objects.select_related('artist', 'member').order_by('-created_at')[:5]

    # 승인 대기중인 생카 5개
    pending_cafes = BdayCafe.objects.filter(status='pending').select_related('artist', 'member').order_by('created_at')[:5]

    return render(request, 'admin/ddoksang/dashboard.html', {
        'stats': stats,
        'recent_cafes': recent_cafes,
        'pending_cafes': pending_cafes,
    })
@admin_required
def admin_cafe_list(request):
    status_filter = request.GET.get('status', '')
    
    cafes = BdayCafe.objects.select_related('artist', 'member', 'submitted_by').order_by('-created_at')
    
    if status_filter:
        cafes = cafes.filter(status=status_filter)
    
    context = {
        'cafes': cafes,
        'status_filter': status_filter,
        'status_choices': BdayCafe.STATUS_CHOICES,
    }
    return render(request, 'admin/ddoksang/cafe_list.html', context)


@admin_required
@require_POST
def approve_cafe(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    cafe.status = 'approved'
    cafe.verified_at = timezone.now()
    cafe.verified_by = request.user
    cafe.save()
    messages.success(request, f"'{cafe.cafe_name}' 생카가 승인되었습니다.")
    return redirect('ddoksang:admin_dashboard')

@admin_required
@require_POST
def reject_cafe(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    cafe.status = 'rejected'
    cafe.verified_at = timezone.now()
    cafe.verified_by = request.user
    cafe.save()
    messages.success(request, f"'{cafe.cafe_name}' 생카가 거절되었습니다.")
    return redirect('ddoksang:admin_dashboard')