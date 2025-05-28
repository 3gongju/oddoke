from django.conf import settings
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import user_passes_test, login_required  # ✅ 여기에 login_required 포함
from django.contrib import messages
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .models import BdayCafe, CafeFavorite, TourPlan
from artist.models import Artist, Member

from django.views.decorators.http import require_http_methods

def is_admin_user(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)

def map_view(request):
    return render(request, 'ddoksang/map.html', {})

@login_required
def create_cafe(request):
    if request.method == "POST":
        artist_id = request.POST.get("artist_id")
        member_id = request.POST.get("member_id")
        cafe_name = request.POST.get("cafe_name")
        address = request.POST.get("address")
        start_date = request.POST.get("start_date")
        end_date = request.POST.get("end_date")

        if not (artist_id and cafe_name and address and start_date and end_date):
            messages.error(request, "필수 항목을 모두 입력해주세요.")
            return redirect("ddoksang:create")

        artist = Artist.objects.get(id=artist_id)
        member = Member.objects.get(id=member_id) if member_id else None

        BdayCafe.objects.create(
            submitted_by=request.user,
            artist=artist,
            member=member,
            cafe_type=request.POST.get("cafe_type", "bday"),
            cafe_name=cafe_name,
            address=address,
            road_address=request.POST.get("road_address", ""),
            latitude=request.POST.get("latitude", 0),
            longitude=request.POST.get("longitude", 0),
            kakao_place_id=request.POST.get("kakao_place_id", ""),
            phone=request.POST.get("phone", ""),
            place_url=request.POST.get("place_url", ""),
            category_name=request.POST.get("category_name", ""),
            start_date=start_date,
            end_date=end_date,
            special_benefits=request.POST.get("special_benefits", ""),
            event_description=request.POST.get("event_description", ""),
            hashtags=request.POST.get("hashtags", ""),
            twitter_source=request.POST.get("twitter_source", ""),
            instagram_source=request.POST.get("instagram_source", ""),
            status="pending"
        )
        messages.success(request, "생일 카페가 성공적으로 등록되었습니다.")
        return redirect("ddoksang:my_cafes")

    context = {
        "kakao_api_key": settings.KAKAO_MAP_API_KEY,
        "artists": Artist.objects.all(),
        "members": Member.objects.select_related().all()
    }
    return render(request, "ddoksang/create.html", context)
def my_cafes(request):
    if not request.user.is_authenticated:
        return redirect('account_login')
    cafes = BdayCafe.objects.filter(submitted_by=request.user).select_related('artist', 'member').order_by('-created_at')
    return render(request, 'ddoksang/my_cafes.html', {'cafes': cafes})

def cafe_list_view(request):
    cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member').order_by('-start_date')
    return render(request, 'ddoksang/cafe_list.html', {'cafes': cafes})

@user_passes_test(is_admin_user)
def admin_dashboard(request):
    stats = {
        'pending': BdayCafe.objects.filter(status='pending').count(),
        'approved': BdayCafe.objects.filter(status='approved').count(),
        'rejected': BdayCafe.objects.filter(status='rejected').count(),
        'total': BdayCafe.objects.count(),
        'this_month': BdayCafe.objects.filter(created_at__month=timezone.now().month).count(),
    }
    recent_cafes = BdayCafe.objects.select_related('artist', 'member', 'submitted_by').order_by('-created_at')[:10]
    pending_cafes = BdayCafe.objects.filter(status='pending').select_related('artist', 'member', 'submitted_by')[:5]
    recent_approved_cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member').order_by('-verified_at')[:5]
    context = {
        'stats': stats,
        'recent_cafes': recent_cafes,
        'pending_cafes': pending_cafes,
        'recent_approved_cafes': recent_approved_cafes,
    }
    return render(request, 'admin/ddoksang/dashboard.html', context)

@user_passes_test(is_admin_user)
def admin_cafe_list(request):
    status_filter = request.GET.get('status', 'all')
    artist_id = request.GET.get('artist_id')
    member_id = request.GET.get('member_id')
    search_query = request.GET.get('search', '')
    sort_by = request.GET.get('sort', 'newest')

    cafes = BdayCafe.objects.select_related('submitted_by')

    if status_filter != 'all':
        cafes = cafes.filter(status=status_filter)
    if artist_id:
        cafes = cafes.filter(artist_id=artist_id)
    if member_id:
        cafes = cafes.filter(member_id=member_id)
    if search_query:
        cafes = cafes.filter(
            Q(cafe_name__icontains=search_query) |
            Q(address__icontains=search_query) |
            Q(member__in=Member.objects.filter(member_name__icontains=search_query))
        )

    if sort_by == 'newest':
        cafes = cafes.order_by('-created_at')
    elif sort_by == 'oldest':
        cafes = cafes.order_by('created_at')
    elif sort_by == 'start_date':
        cafes = cafes.order_by('start_date')

    paginator = Paginator(cafes, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    context = {
        'page_obj': page_obj,
        'status_filter': status_filter,
        'sort_by': sort_by,
        'artist_id': artist_id,
        'member_id': member_id,
        'search_query': search_query,
        'artists': Artist.objects.annotate(num_members=Count('members')).all(),
        'members': Member.objects.prefetch_related('artist_name').all(),
    }

    return render(request, 'admin/ddoksang/cafe_list.html', context)

@user_passes_test(is_admin_user)
def admin_cafe_detail(request, cafe_id):
    cafe = get_object_or_404(BdayCafe.objects.select_related('artist', 'member', 'submitted_by', 'verified_by'), id=cafe_id)

    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'approve':
            cafe.status = 'approved'
            cafe.verified_at = timezone.now()
            cafe.verified_by = request.user
            cafe.save()
            messages.success(request, f'{cafe.cafe_name}이(가) 승인되었습니다.')
        elif action == 'reject':
            cafe.status = 'rejected'
            cafe.verified_at = timezone.now()
            cafe.verified_by = request.user
            cafe.save()
            messages.warning(request, f'{cafe.cafe_name}이(가) 거절되었습니다.')
        return redirect('ddoksang:admin_cafe_detail', cafe_id=cafe.id)

    return render(request, 'admin/ddoksang/cafe_detail.html', {'cafe': cafe})


@user_passes_test(is_admin_user)
@require_http_methods(["POST"])
def approve_cafe(request, cafe_id):
    """관리자 승인 처리"""
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    if cafe.status != 'pending':
        return JsonResponse({'success': False, 'message': '이미 처리된 요청입니다.'})

    cafe.status = 'approved'
    cafe.verified_at = timezone.now()
    cafe.save()

    return JsonResponse({'success': True, 'message': '승인 완료'})

@user_passes_test(is_admin_user)
@require_http_methods(["POST"])
def reject_cafe(request, cafe_id):
    """관리자 거절 처리"""
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    if cafe.status != 'pending':
        return JsonResponse({'success': False, 'message': '이미 처리된 요청입니다.'})

    cafe.status = 'rejected'
    cafe.verified_at = timezone.now()
    cafe.save()

    return JsonResponse({'success': True, 'message': '거절 처리 완료'})

from django.views.decorators.http import require_POST
from django.http import JsonResponse
from .models import BdayCafe

@user_passes_test(is_admin_user)
@require_POST
def bulk_action(request):
    """체크된 생일카페를 일괄 승인 또는 거절"""
    action = request.POST.get("action")
    ids = request.POST.getlist("cafe_ids[]")

    if not ids:
        return JsonResponse({'success': False, 'message': '선택된 항목이 없습니다.'})

    cafes = BdayCafe.objects.filter(id__in=ids, status='pending')
    count = cafes.count()

    if action == 'approve':
        cafes.update(status='approved', verified_at=timezone.now())
        message = f'{count}개 항목 승인 완료'
    elif action == 'reject':
        cafes.update(status='rejected', verified_at=timezone.now())
        message = f'{count}개 항목 거절 완료'
    else:
        return JsonResponse({'success': False, 'message': '올바르지 않은 액션입니다.'})

    return JsonResponse({'success': True, 'message': message})
