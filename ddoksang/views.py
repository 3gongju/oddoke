from django.conf import settings
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import user_passes_test, login_required
from django.contrib import messages
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_POST
from django.views.decorators.csrf import csrf_exempt
from .models import BdayCafe, CafeFavorite, TourPlan
from artist.models import Artist, Member
import json

def is_admin_user(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)

def bday_cafe_map(request):  
    """생카 지도 메인 페이지"""
    # 현재 진행 중인 생카들만 가져오기
    active_bday_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=timezone.now().date(),
        end_date__gte=timezone.now().date()
    ).select_related('artist', 'member')
    
    # 지도에 표시할 데이터 준비
    bday_cafe_data = [bday_cafe.get_kakao_map_data() for bday_cafe in active_bday_cafes]
    
    context = {
        'bday_cafes_json': json.dumps(bday_cafe_data),
        'total_bday_cafes': len(bday_cafe_data),
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    
    return render(request, 'ddoksang/map.html', context)

def bday_cafe_list_api(request):  
    """생카 목록 API (테스트용)"""
    bday_cafes = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member').order_by('-start_date')
    
    bday_cafe_data = []
    for bday_cafe in bday_cafes:
        bday_cafe_data.append({
            'id': bday_cafe.id,
            'name': bday_cafe.cafe_name,
            'artist': bday_cafe.artist.display_name,
            'member': bday_cafe.member.member_name if bday_cafe.member else None,
            'address': bday_cafe.address,
            'latitude': float(bday_cafe.latitude),
            'longitude': float(bday_cafe.longitude),
            'start_date': bday_cafe.start_date.strftime('%Y-%m-%d'),
            'end_date': bday_cafe.end_date.strftime('%Y-%m-%d'),
            'is_active': bday_cafe.is_active,
            'main_image': bday_cafe.main_image.url if bday_cafe.main_image else None,
        })
    
    return JsonResponse({
        'success': True,
        'bday_cafes': bday_cafe_data,
        'total': len(bday_cafe_data)
    })

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

# 🔥 생일카페 등록 API
@csrf_exempt
@login_required
@require_http_methods(["POST"])
def create_bday_cafe(request):
    """생일카페 등록 API"""
    try:
        data = json.loads(request.body)
        
        # 필수 필드 검증
        required_fields = ['artist_id', 'cafe_name', 'address', 'latitude', 'longitude', 'start_date', 'end_date']
        for field in required_fields:
            if not data.get(field):
                return JsonResponse({'success': False, 'error': f'{field} 필드가 누락되었습니다.'})
        
        # Artist 존재 확인
        try:
            artist = Artist.objects.get(id=data['artist_id'])
        except Artist.DoesNotExist:
            return JsonResponse({'success': False, 'error': '존재하지 않는 아티스트입니다.'})
        
        # Member 존재 확인 (선택사항)
        member = None
        if data.get('member_id'):
            try:
                member = Member.objects.get(id=data['member_id'])
            except Member.DoesNotExist:
                return JsonResponse({'success': False, 'error': '존재하지 않는 멤버입니다.'})
        
        # BdayCafe 생성
        bday_cafe = BdayCafe.objects.create(
            submitted_by=request.user,
            artist=artist,
            member=member,
            cafe_type=data.get('cafe_type', 'bday'),
            cafe_name=data['cafe_name'],
            address=data['address'],
            road_address=data.get('road_address', ''),
            latitude=float(data['latitude']),
            longitude=float(data['longitude']),
            start_date=data['start_date'],
            end_date=data['end_date'],
            special_benefits=data.get('special_benefits', ''),
            event_description=data.get('event_description', ''),
            hashtags=data.get('hashtags', ''),
            twitter_source=data.get('twitter_source', ''),
            instagram_source=data.get('instagram_source', ''),
            status='pending'  # 관리자 승인 필요
        )
        
        return JsonResponse({
            'success': True, 
            'message': '생일카페가 성공적으로 등록되었습니다!',
            'cafe_id': bday_cafe.id
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'JSON 형식이 올바르지 않습니다.'})
    except ValueError as e:
        return JsonResponse({'success': False, 'error': f'데이터 형식 오류: {str(e)}'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'서버 오류: {str(e)}'})

def create_bday_cafe_form(request):
    """생일카페 등록 폼 페이지"""
    context = {
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/create.html', context)