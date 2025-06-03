# 카페 등록, 수정, 찜하기 관련 뷰들

from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.db import transaction
from django.core.paginator import Paginator
from django.core.cache import cache
from django.db.models import F, Q
from django.conf import settings
from django.urls import reverse
from datetime import date
import json
import logging

from ..models import BdayCafe, BdayCafeImage, CafeFavorite
from ..forms import BdayCafeForm, BdayCafeImageForm
from artist.models import Artist, Member
from .utils import get_user_favorites, get_nearby_cafes, get_safe_cafe_map_data

logger = logging.getLogger(__name__)

@login_required
def create_cafe(request):
    if request.method == 'GET':
        form = BdayCafeForm()
        image_form = BdayCafeImageForm()
        artists = Artist.objects.all().order_by('display_name')
        
        context = {
            'form': form,
            'image_form': image_form,
            'artists': artists,
            'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        }
        return render(request, 'ddoksang/create.html', context)
    
    elif request.method == 'POST':
        # POST 데이터를 폼에 맞게 변환
        form_data = request.POST.copy()
        
        # 아티스트 유효성 검증 및 매핑
        artist_id = form_data.get('artist_id')
        
        if not artist_id:
            messages.error(request, "아티스트를 선택해주세요.")
            return redirect('ddoksang:create')
            
        try:
            artist = Artist.objects.get(id=artist_id)
            form_data['artist'] = artist.id
        except Artist.DoesNotExist:
            messages.error(request, "유효하지 않은 아티스트입니다.")
            return redirect('ddoksang:create')

        # 멤버 유효성 검증 및 매핑 (선택적)
        member_id = form_data.get('member_id')
        
        if member_id:
            try:
                member = Member.objects.get(id=member_id)
                form_data['member'] = member.id
            except Member.DoesNotExist:
                messages.warning(request, "유효하지 않은 멤버입니다. 멤버 정보를 제외하고 등록합니다.")
                form_data['member'] = ''
        else:
            form_data['member'] = ''

        # 카카오맵 API 데이터 처리 추가
        kakao_place_data = request.POST.get('kakao_place_data')
        if kakao_place_data:
            try:
                place_info = json.loads(kakao_place_data)
                # place_name 추가
                if 'place_name' in place_info:
                    form_data['place_name'] = place_info['place_name']
                    
                # 기타 카카오맵 데이터도 업데이트
                if 'address_name' in place_info:
                    form_data['address'] = place_info['address_name']
                if 'road_address_name' in place_info:
                    form_data['road_address'] = place_info['road_address_name']
                if 'id' in place_info:
                    form_data['kakao_place_id'] = place_info['id']
                if 'x' in place_info:
                    form_data['longitude'] = place_info['x']
                if 'y' in place_info:
                    form_data['latitude'] = place_info['y']
            except json.JSONDecodeError:
                messages.warning(request, "카카오맵 정보 처리 중 오류가 발생했습니다.")

        # 특전 정보 처리
        perks = request.POST.getlist('perks')
        if perks:
            form_data['special_benefits'] = ', '.join(perks)

        # artist_id, member_id 제거 (폼에서 인식하지 않는 필드)
        if 'artist_id' in form_data:
            del form_data['artist_id']
        if 'member_id' in form_data:
            del form_data['member_id']
        
        form = BdayCafeForm(form_data, request.FILES)

        if form.is_valid():
            try:
                with transaction.atomic():
                    cafe = form.save(commit=False)
                    cafe.submitted_by = request.user
                    cafe.status = 'pending'
                    
                    cafe.place_name = form.cleaned_data.get('place_name')
                    
                    cafe.save()

                    # 다중 이미지 저장
                    images = request.FILES.getlist('images')
                        
                    for idx, image_file in enumerate(images):
                        image_type = 'main' if idx == 0 else 'other'
                        is_main = idx == 0
                        
                        BdayCafeImage.objects.create(
                            cafe=cafe,
                            image=image_file,
                            image_type=image_type,
                            order=idx,
                            is_main=is_main,
                        )
                
                    # 캐시 무효화 (새로운 카페가 추가되었으므로)
                    cache.delete_many([
                        'featured_cafes',
                        'latest_cafes',
                        'admin_stats',
                    ])
                    
                    messages.success(request, f"'{cafe.cafe_name}' 생일카페가 성공적으로 등록되었습니다! 관리자 승인 후 공개됩니다.")

                    return redirect('ddoksang:cafe_create_success', cafe_id=cafe.id)

            except Exception as e:
                logger.error(f"카페 등록 중 오류: {str(e)}")
                messages.error(request, f"등록 중 오류가 발생했습니다: {str(e)}")
        else:
            # 폼 검증 실패
            error_messages = []
            for field, errors in form.errors.items():
                for error in errors:
                    error_messages.append(f"{field}: {error}")
            messages.error(request, f"입력 정보를 확인해주세요: {', '.join(error_messages)}")
        
        return redirect('ddoksang:create')

@login_required
def cafe_create_success(request, cafe_id):
    """생일카페 등록 완료 페이지"""
    try:
        # 사용자가 등록한 카페만 볼 수 있도록
        cafe = get_object_or_404(BdayCafe, id=cafe_id, submitted_by=request.user)
    except:
        messages.error(request, "등록 정보를 찾을 수 없습니다.")
        return redirect('ddoksang:my_cafes')
    
    context = {
        'cafe': cafe,
    }
    return render(request, 'ddoksang/create_success.html', context)

from django.db.models import Q

@login_required
def my_cafes(request):
    """사용자가 등록한 카페 목록"""
    page = request.GET.get('page', 1)
    status_filter = request.GET.get('status', '')
    runtime_filter = request.GET.get('runtime', '')
    query = request.GET.get('q', '').strip()

    cafes = BdayCafe.objects.filter(
        submitted_by=request.user
    ).select_related('artist', 'member')

    # ✅ 검색어가 있다면 아티스트/멤버명 기준으로 필터링
    if query:
        cafes = cafes.filter(
            Q(artist__display_name__icontains=query) |
            Q(member__member_name__icontains=query)
        )

    # ✅ 상태 필터 적용
    if status_filter:
        cafes = cafes.filter(status=status_filter)
    
    # ✅ 운영 상태 필터 적용
    today = date.today()
    if runtime_filter == 'active':
        cafes = cafes.filter(start_date__lte=today, end_date__gte=today)
    elif runtime_filter == 'upcoming':
        cafes = cafes.filter(start_date__gt=today)
    elif runtime_filter == 'ended':
        cafes = cafes.filter(end_date__lt=today)

    # ✅ 정렬
    sort = request.GET.get('sort', 'latest')
    if sort == "start_date":
        cafes = cafes.order_by("start_date")
    elif sort == "oldest":
        cafes = cafes.order_by("created_at")
    else:
        cafes = cafes.order_by("-created_at")  # 기본 최신순

    paginator = Paginator(cafes, 10)
    cafes_page = paginator.get_page(page)

    # 통계 계산
    stats = {
        'total': BdayCafe.objects.filter(submitted_by=request.user).count(),
        'pending': BdayCafe.objects.filter(submitted_by=request.user, status='pending').count(),
        'approved': BdayCafe.objects.filter(submitted_by=request.user, status='approved').count(),
        'rejected': BdayCafe.objects.filter(submitted_by=request.user, status='rejected').count(),
    }

    # 상태 필터 탭 생성
    status_filters = [
        {
            'text': '전체',
            'url': f'?q={query}&runtime={runtime_filter}&sort={sort}',
            'active': not status_filter
        },
        {
            'text': f'승인 대기 ({stats["pending"]})',
            'url': f'?q={query}&status=pending&runtime={runtime_filter}&sort={sort}',
            'active': status_filter == 'pending'
        },
        {
            'text': f'승인됨 ({stats["approved"]})',
            'url': f'?q={query}&status=approved&runtime={runtime_filter}&sort={sort}',
            'active': status_filter == 'approved'
        },
        {
            'text': f'거절됨 ({stats["rejected"]})',
            'url': f'?q={query}&status=rejected&runtime={runtime_filter}&sort={sort}',
            'active': status_filter == 'rejected'
        },
    ]

    # 운영 상태 필터 생성
    runtime_filters = [
        {
            'text': '전체',
            'url': f'?q={query}&status={status_filter}&sort={sort}',
            'active': not runtime_filter
        },
        {
            'text': '운영중',
            'url': f'?q={query}&status={status_filter}&runtime=active&sort={sort}',
            'active': runtime_filter == 'active'
        },
        {
            'text': '예정',
            'url': f'?q={query}&status={status_filter}&runtime=upcoming&sort={sort}',
            'active': runtime_filter == 'upcoming'
        },
        {
            'text': '종료',
            'url': f'?q={query}&status={status_filter}&runtime=ended&sort={sort}',
            'active': runtime_filter == 'ended'
        },
    ]

    # 액션 버튼 데이터
    action_buttons = [
        {
            'text': '+ 생카 등록',
            'url': reverse('ddoksang:create'),
            'class': 'bg-gray-900 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition-all duration-200 text-sm sm:text-base'
        }
    ]

    context = {
        'cafes': cafes_page,
        'stats': stats,
        'status_filters': status_filters,
        'runtime_filters': runtime_filters,
        'action_buttons': action_buttons,  # 변수명 수정
        'query': query,
        'search_url': request.path,  # 현재 페이지 URL
        'search_placeholder': '내 등록 카페에서 아티스트/멤버 검색...',
        'search_input_id': 'my-cafes-search',
        'autocomplete_list_id': 'my-cafes-autocomplete',
        'extra_params': {
            'status': status_filter,
            'runtime': runtime_filter,
            'sort': sort,
        },
        'autocomplete_config': {
            'show_birthday': True,
            'show_artist_tag': True,
            'submit_on_select': True,
            'artist_only': False,
            'api_url': '/artist/autocomplete/'
        }
    }

    return render(request, 'ddoksang/my_cafes.html', context)

@login_required
@require_POST
def toggle_favorite(request, cafe_id):
    """카페 찜하기/찜해제 토글"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id, status='approved')
        favorite, created = CafeFavorite.objects.get_or_create(
            user=request.user,
            cafe=cafe
        )
        
        if not created:
            favorite.delete()
            is_favorited = False
            message = "찜이 해제되었습니다."
        else:
            is_favorited = True
            message = "찜 목록에 추가되었습니다."
        
        return JsonResponse({
            'success': True,
            'is_favorited': is_favorited,
            'message': message
        })
        
    except Exception as e:
        logger.error(f"찜하기 토글 오류: {e}")
        return JsonResponse({
            'success': False,
            'error': '오류가 발생했습니다.'
        })

@login_required
def favorites_view(request):
    """찜한 카페 목록"""
    page = request.GET.get('page', 1)
    
    # 사용자가 찜한 카페들
    favorites = CafeFavorite.objects.filter(
        user=request.user
    ).select_related('cafe__artist', 'cafe__member').order_by('-created_at')
    
    # 페이징 처리
    paginator = Paginator(favorites, 12)
    favorites_page = paginator.get_page(page)
    
    context = {
        'favorites': favorites_page,
        'total_count': favorites.count(),
    }
    return render(request, 'ddoksang/favorites.html', context)

@login_required
def user_preview_cafe(request, cafe_id):
    """사용자 미리보기 (자신이 등록한 카페만, 상태 무관)"""
    cafe = get_object_or_404(BdayCafe, id=cafe_id, submitted_by=request.user)
    
    context = {
        'cafe': cafe,
        'is_favorited': False,
        'nearby_cafes': [],
        'user_favorites': [],
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        'is_preview': True,
        'can_edit': True,
        'preview_type': 'user',
    }
    return render(request, 'ddoksang/detail.html', context)

# 추가로 필요한 함수들
def cafe_image_upload_view(request):
    """카페 이미지 업로드"""
    from django.http import JsonResponse
    return JsonResponse({"status": "이미지 업로드 기능 - 개발 중"})

def cafe_image_delete_view(request, image_id):
    """카페 이미지 삭제"""
    from django.http import JsonResponse
    return JsonResponse({"status": f"이미지 {image_id} 삭제 기능 - 개발 중"})

def cafe_edit_view(request, cafe_id):
    """카페 수정"""
    from django.http import HttpResponse
    return HttpResponse(f"카페 {cafe_id} 수정 기능 - 개발 중")

def my_favorites_view(request):
    """내 찜 목록 (favorites_view와 동일)"""
    return favorites_view(request)