# 카페 등록, 수정, 찜하기 관련 뷰들

from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.utils.safestring import mark_safe
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.db import transaction
from django.core.paginator import Paginator
from django.core.cache import cache
from django.db.models import F, Q
from django.views.decorators.csrf import csrf_protect
from django.db import IntegrityError, transaction
from django.urls import reverse
from datetime import date
from ddoksang.messages import ALL_MESSAGES
import json
import logging
from django.template.loader import render_to_string

from ..utils.cafe_utils import get_cafe_detail_context

from ddoksang.utils.favorite_utils import get_user_favorites

from ..models import BdayCafe
from ..forms import BdayCafeForm
from ..utils.map_utils import get_map_context, get_nearby_cafes  # 유틸리티 사용
from artist.models import Artist, Member


logger = logging.getLogger(__name__)


@login_required(login_url='/accounts/login/')
def cafe_create_view(request):
    if request.method == 'POST':
        try:
            uploaded_files = request.FILES.getlist('images')

            # 파일 검증
            valid_files = []
            for file in uploaded_files:
                if (
                    file.name.strip() and 
                    file.size > 0 and 
                    file.content_type.startswith('image/') and
                    file.size <= 10 * 1024 * 1024  # 10MB 제한
                ):
                    valid_files.append(file)

            # x_source 처리 
            raw_x_source = request.POST.get('x_source', '').strip()
            x_source = ''

            if raw_x_source:
                if raw_x_source.startswith('@'):
                    username = raw_x_source[1:].strip()
                    if username:
                        x_source = f"https://x.com/{username}"
                elif raw_x_source.startswith('https://x.com/') or raw_x_source.startswith('https://twitter.com/'):
                    x_source = raw_x_source
                elif raw_x_source and '/' not in raw_x_source:
                    x_source = f"https://x.com/{raw_x_source}"

            # 카페 데이터
            cafe_data = {
                'submitted_by': request.user,
                'artist_id': request.POST.get('artist_id'),
                'member_id': request.POST.get('member_id') or None,
                'cafe_type': request.POST.get('cafe_type', 'bday'),
                'cafe_name': request.POST.get('cafe_name'),
                'place_name': request.POST.get('place_name', ''),
                'address': request.POST.get('address'),
                'road_address': request.POST.get('road_address', ''),
                'kakao_place_id': request.POST.get('kakao_place_id', ''),
                'latitude': float(request.POST.get('latitude')),
                'longitude': float(request.POST.get('longitude')),
                'start_date': request.POST.get('start_date'),
                'end_date': request.POST.get('end_date'),
                'event_description': request.POST.get('event_description', ''),
                'x_source': x_source,
                'status': 'pending',
                'image_gallery': []  # ✅ 빈 이미지 갤러리로 초기화
            }

            # 특전 정보 처리
            perks = []
            for cat, label in [
                ('perks', '일반'),
                ('perks_priority', '선착'),
                ('perks_extra', '기타')
            ]:
                items = request.POST.getlist(cat)
                if items:
                    perks.extend([f"{label}:{item}" for item in items])

            cafe_data['special_benefits'] = ', '.join(perks)

            # ✅ 카페 생성 후 이미지 추가
            with transaction.atomic():
                # 카페 생성
                cafe = BdayCafe.objects.create(**cafe_data)

                # ✅ JSON 기반 이미지 갤러리에 이미지 추가
                for index, image_file in enumerate(valid_files):
                    cafe.add_image(
                        image_file=image_file,
                        image_type='main' if index == 0 else 'other',
                        is_main=(index == 0),  # 첫 번째 이미지가 대표
                        order=index
                    )

            messages.success(request, '생일카페가 성공적으로 등록되었습니다.')
            return redirect('ddoksang:cafe_create_success', cafe_id=cafe.id)

        except Exception as e:
            messages.error(request, f'등록 중 오류가 발생했습니다: {e}')
            return redirect('ddoksang:create')

    # GET 요청 처리
    from ddoksang.messages import ALL_MESSAGES
    kakao_api_key = (
        getattr(settings, 'KAKAO_MAP_API_KEY', '') or 
        getattr(settings, 'KAKAO_API_KEY', '') or ''
    )
    messages_json = json.dumps(ALL_MESSAGES, ensure_ascii=False)

    context = {
        'kakao_api_key': kakao_api_key,
        'messages_json': messages_json,
    }
    return render(request, 'ddoksang/create.html', context)


@login_required
def cafe_create_success(request, cafe_id):
    """카페 등록 완료 페이지"""
    try:
        cafe = get_object_or_404(
            BdayCafe.objects.select_related('artist', 'member'),  # ✅ prefetch_related 제거
            id=cafe_id,
            submitted_by=request.user
        )
        
        print(f" 등록 성공 페이지: 카페 ID {cafe.id}")
        print(f"   카페명: {cafe.cafe_name}")
        print(f"   아티스트: {cafe.artist.display_name if cafe.artist else 'N/A'}")
        print(f"   멤버: {cafe.member.member_name if cafe.member else 'N/A'}")
        print(f"   이미지 갤러리: {len(cafe.image_gallery)}장")  # ✅ JSON 기반 이미지 확인
        
        # ✅ 이미지 정보 출력 (JSON 기반)
        if cafe.image_gallery:
            print(f"📸 이미지 갤러리 ({len(cafe.image_gallery)}장):")
            for i, img in enumerate(cafe.image_gallery):
                print(f"  - 이미지 {i+1}: {img.get('url', 'N/A')}")
                print(f"    타입: {img.get('type', 'N/A')}, 메인: {img.get('is_main', False)}")
        else:
            print("  ❌ 이미지 갤러리가 비어있음")
        
        # 특전 정보 파싱 (디스플레이용)
        parsed_benefits = []
        if cafe.special_benefits:
            for benefit in cafe.special_benefits.split(','):
                benefit = benefit.strip()
                if ':' in benefit:
                    category, item = benefit.split(':', 1)
                    parsed_benefits.append({
                        'category': category.strip(),
                        'item': item.strip()
                    })
                else:
                    parsed_benefits.append({
                        'category': '일반',
                        'item': benefit
                    })
        
        context = {
            'cafe': cafe,
            'parsed_benefits': parsed_benefits,
            'kakao_api_key': getattr(settings, 'KAKAO_API_KEY', ''),
        }
        
        return render(request, 'ddoksang/create_success.html', context)
        
    except BdayCafe.DoesNotExist:
        messages.error(request, '해당 카페를 찾을 수 없거나 접근 권한이 없습니다.')
        return redirect('ddoksang:home')
    except Exception as e:
        print(f"❌ create_success 뷰 오류: {e}")
        messages.error(request, '페이지 로드 중 오류가 발생했습니다.')
        return redirect('ddoksang:home')

@login_required
def my_cafes(request):
    """사용자가 등록한 카페 목록"""
    page = request.GET.get('page', 1)
    status_filter = request.GET.get('status', '')
    runtime_filter = request.GET.get('runtime', '')
    query = request.GET.get('q', '').strip()
    search_scope = request.GET.get('scope', 'my')

    # 전체 검색이면 search 페이지로 리다이렉트
    if query and search_scope == 'all':
        return redirect(f"{reverse('ddoksang:search')}?q={query}")

    cafes = BdayCafe.objects.filter(
        submitted_by=request.user
    ).select_related('artist', 'member')

    # 검색어가 있다면 아티스트/멤버명 기준으로 필터링
    if query and search_scope == 'my':
        cafes = cafes.filter(
            Q(artist__display_name__icontains=query) |
            Q(member__member_name__icontains=query)
        )

    # 상태 필터 적용
    if status_filter:
        cafes = cafes.filter(status=status_filter)
    
    # 운영 상태 필터 적용
    today = date.today()
    if runtime_filter == 'active':
        cafes = cafes.filter(start_date__lte=today, end_date__gte=today)
    elif runtime_filter == 'upcoming':
        cafes = cafes.filter(start_date__gt=today)
    elif runtime_filter == 'ended':
        cafes = cafes.filter(end_date__lt=today)

    # 정렬
    sort = request.GET.get('sort', 'latest')
    if sort == "start_date":
        cafes = cafes.order_by("start_date")
    elif sort == "oldest":
        cafes = cafes.order_by("created_at")
    else:
        cafes = cafes.order_by("-created_at")  # 기본 최신순

    paginator = Paginator(cafes, 12)
    cafes_page = paginator.get_page(page)

    # 통계 계산
    base_cafes = BdayCafe.objects.filter(submitted_by=request.user)
    
    if query:
        search_cafes = base_cafes.filter(
            Q(artist__display_name__icontains=query) |
            Q(member__member_name__icontains=query)
        )
        stats = {
            'total': search_cafes.count(),
            'pending': search_cafes.filter(status='pending').count(),
            'approved': search_cafes.filter(status='approved').count(),
            'rejected': search_cafes.filter(status='rejected').count(),
        }
    else:
        stats = {
            'total': base_cafes.count(),
            'pending': base_cafes.filter(status='pending').count(),
            'approved': base_cafes.filter(status='approved').count(),
            'rejected': base_cafes.filter(status='rejected').count(),
        }

    # 상태 필터 탭 생성
    filter_prefix = f"'{query}' 검색 결과" if query else ""
    
    status_filters = [
        {
            'text': f'{filter_prefix} 전체' if query else '전체',
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

    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)

    context = {
        'cafes': cafes_page,
        'stats': stats,
        'status_filters': status_filters,
        'runtime_filters': runtime_filters,
        'query': query,
        'search_scope': search_scope,
        'user_favorites': user_favorites,
        'extra_params': {
            'status': status_filter,
            'runtime': runtime_filter,
            'sort': sort,
            'scope': search_scope,
        },
        'action_buttons': action_buttons,
        'search_placeholder': '내 등록 카페에서 아티스트/멤버 검색...',
        'search_url': request.path,
        'search_input_id': 'my-cafes-search',
        'autocomplete_list_id': 'my-cafes-autocomplete',
        'autocomplete_options': {
            'show_birthday': True,
            'show_artist_tag': True,
            'submit_on_select': True,
            'artist_only': False,
            'api_url': '/artist/autocomplete/'
        },
        'filter_tags': status_filters,
        'show_results_summary': False,
        'total_count': cafes_page.paginator.count,
    }

    return render(request, 'ddoksang/my_cafes.html', context)


@login_required
@require_POST
def toggle_favorite(request, cafe_id):
    """카페 찜하기/찜해제 토글 (HTML 조각 포함)"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id, status='approved')
        
        # ✅ ManyToManyField 사용한 간단한 토글
        if request.user.favorite_cafes.filter(id=cafe_id).exists():
            # 찜 해제
            request.user.favorite_cafes.remove(cafe)
            is_favorited = False
            message = "찜 목록에서 제거했어요!"
            card_html = None
        else:
            # 찜 추가
            request.user.favorite_cafes.add(cafe)
            is_favorited = True
            message = "찜 목록에 추가했어요!"
            
            # 찜 추가 시에만 HTML 조각 렌더링
            card_html = render_to_string(
                'ddoksang/components/_cafe_card_base.html',
                {
                    'cafe': cafe,
                    'card_variant': 'favorite',
                    'user': request.user,
                    'user_favorites': get_user_favorites(request.user),
                    'show_favorite_btn': True,
                    'show_status_badge': True,
                },
                request=request
            )
        
        # 캐시 무효화
        cache_key = f"user_favorites_{request.user.id}"
        cache.delete(cache_key)

        return JsonResponse({
            'success': True,
            'is_favorited': is_favorited,
            'message': message,
            'cafe_id': str(cafe_id),
            'card_html': card_html,
        })

    except Exception as e:
        logger.error(f"찜하기 토글 오류: {e}")
        return JsonResponse({
            'success': False,
            'error': '처리 중 오류가 발생했습니다.'
        }, status=500)

@login_required
def favorites_view(request):
    """찜한 카페 목록 페이지"""
    #  ManyToManyField 사용
    favorite_cafes = request.user.favorite_cafes.select_related(
        'artist', 'member'
    ).order_by('-id')  # 최신순 정렬 (created_at 대신 id 사용)
    
    # 사용자 찜 목록 (ID 리스트)
    user_favorites = list(
        request.user.favorite_cafes.values_list('id', flat=True)
    )
    
    # 템플릿 호환성을 위해 기존 구조 유지
    context = {
        'favorites': [{'cafe': cafe} for cafe in favorite_cafes],
        'user_favorites': user_favorites,
    }
    
    return render(request, 'ddoksang/favorites.html', context)


@login_required
def user_preview_cafe(request, cafe_id):
    """사용자 미리보기 (자신이 등록한 카페만, 상태 무관)"""

    
    cafe = get_object_or_404(BdayCafe, id=cafe_id, submitted_by=request.user)
    
    context = get_cafe_detail_context(
        cafe, 
        request.user, 
        is_preview=True, 
        can_edit=True, 
        preview_type='user'
    )
    return render(request, 'ddoksang/detail.html', context)

@login_required
def cafe_image_upload_view(request):
    """카페 이미지 업로드 API"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'POST 요청만 허용됩니다.'})
    
    try:
        cafe_id = request.POST.get('cafe_id')
        image_file = request.FILES.get('image')
        image_type = request.POST.get('image_type', 'other')
        is_main = request.POST.get('is_main', 'false').lower() == 'true'
        
        if not cafe_id or not image_file:
            return JsonResponse({'success': False, 'error': '필수 파라미터가 누락되었습니다.'})
        
        # 카페 조회 (권한 확인)
        cafe = get_object_or_404(BdayCafe, id=cafe_id, submitted_by=request.user)
        
        # ✅ JSON 기반 이미지 추가
        image_data = cafe.add_image(
            image_file=image_file,
            image_type=image_type,
            is_main=is_main
        )
        
        return JsonResponse({
            'success': True,
            'image': image_data,
            'message': '이미지가 업로드되었습니다.'
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


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
def tour_map_view(request):
    """투어맵 뷰 - 유틸리티 사용으로 간소화"""
    from datetime import date
    import logging
    
    logger = logging.getLogger(__name__)
    today = date.today()
    
    # 현재 운영중인 카페들만 가져오기
    cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member')
    
    logger.info(f"운영중인 카페 수: {cafes.count()}")
    
    # 지도 관련 컨텍스트 생성 (유틸리티 사용)
    map_context = get_map_context(cafes_queryset=cafes)
    
    # 디버깅 정보
    debug_info = {
        "total_queried": cafes.count(),
        "total_valid": map_context.get('total_cafes', 0),
        "today": today.strftime('%Y-%m-%d')
    }
    
    context = {
        **map_context,  # 지도 관련 컨텍스트 (cafes_json, total_cafes 등 포함)
        "debug_info": debug_info
    }
    
    return render(request, 'ddoksang/tour_map.html', context)
