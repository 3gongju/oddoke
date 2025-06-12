# ddoksang/views/base_views.py
# 홈 뷰 업데이트 - map_utils 사용으로 코드 정리

import logging
from datetime import timedelta, date

from django.shortcuts import render, get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.db.models import Q, F
from django.views.decorators.cache import cache_page
from django.core.paginator import Paginator
from django.core.cache import cache
from django.conf import settings

from ddoksang.models import BdayCafe, CafeFavorite
from ddoksang.utils.favorite_utils import get_user_favorites
from ddoksang.utils.map_utils import (
    get_map_context, 
    get_nearby_cafes, 
    filter_operating_cafes,
    serialize_cafe_for_map
)
from artist.models import Artist, Member
from ddoksang.utils.bday_utils import get_weekly_bday_artists

logger = logging.getLogger(__name__)


def home_view(request):
    """홈 뷰 - 지도 + 현재 운영중인 카페 리스트 + 생일 멤버"""
    today = timezone.now().date()

    # === 1. 이번  생일 아티스트 ===
    birthday_artists = get_weekly_bday_artists

    # === 2. 현재 운영중인 생일카페들 (지도용) ===
    approved_cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member').prefetch_related('images')
    active_cafes = filter_operating_cafes(approved_cafes).order_by('-created_at')

    # === 3. 최신 등록된 카페들 (모든 승인된 카페) ===
    latest_cafes = approved_cafes.order_by('-created_at')[:6]  # 최신 등록 순으로 6개
    total_latest_cafes_count = approved_cafes.count()

    # === 4. 사용자 찜 목록 ===
    my_favorite_cafes = []
    user_favorites = []
    if request.user.is_authenticated:
        user_favorites = list(
            CafeFavorite.objects.filter(user=request.user)
            .values_list('cafe_id', flat=True)
        )

        # 찜한 카페를 찜 시간순으로 가져오기 
        favorites = CafeFavorite.objects.filter(
            user=request.user,
            cafe__status='approved'
        ).select_related('cafe__artist', 'cafe__member') \
        .order_by('-created_at')[:10]

        my_favorite_cafes = [fav.cafe for fav in favorites]

    # === 5. 지도용 컨텍스트 생성 (map_utils 사용) ===
    map_context = get_map_context(cafes_queryset=active_cafes)
    
    # ✅ 지도용 JSON 데이터 추가 (템플릿에서 직접 접근 가능)
    cafes_json_data = []
    for cafe in active_cafes:
        cafe_data = serialize_cafe_for_map(cafe)
        if cafe_data:
            cafes_json_data.append(cafe_data)

    # === 6. 템플릿 컨텍스트 ===
    context = {
        'birthday_artists': birthday_artists,
        'latest_cafes': latest_cafes,
        'total_latest_cafes_count': total_latest_cafes_count,
        'active_cafes': active_cafes,  # 사이드바용
        'my_favorite_cafes': my_favorite_cafes,
        'user_favorites': user_favorites,
        
        # 지도 관련 (map_utils에서 생성)
        'cafes_json': cafes_json_data,
        'total_cafes': len(cafes_json_data),
        
        **map_context,  # kakao_api_key, default_center 등 포함
    }
    
    logger.info(f"홈페이지 로드: 운영중 카페 {len(cafes_json_data)}개, 최신 카페 {len(latest_cafes)}개")
    
    return render(request, 'ddoksang/home.html', context)


def search_view(request):
    """통합 검색 페이지"""
    query = request.GET.get('q', '').strip()
    page = request.GET.get('page', 1)
    status_filter = request.GET.get('status', '')  # ongoing, upcoming, ended
    sort_order = request.GET.get('sort', 'latest')
    
    results = []
    total_count = 0
    
    if query and len(query) >= 2:
        # 카페 검색 - 아티스트/멤버만
        cafes = BdayCafe.objects.filter(
            Q(artist__display_name__icontains=query) |
            Q(member__member_name__icontains=query),
            status='approved'
        ).select_related('artist', 'member').distinct()
        
        # ✅ 간단한 상태 필터링 (map_utils 함수 활용 가능하지만 여기서는 직접 구현)
        today = timezone.now().date()
        
        if status_filter == 'ongoing':
            cafes = cafes.filter(start_date__lte=today, end_date__gte=today)
        elif status_filter == 'upcoming':
            cafes = cafes.filter(start_date__gt=today)
        elif status_filter == 'ended':
            cafes = cafes.filter(end_date__lt=today)
        
        # 정렬
        if sort_order == 'latest':
            cafes = cafes.order_by('-created_at')
        elif sort_order == 'start_date':
            cafes = cafes.order_by('start_date', '-created_at')
        
        # 페이징 처리
        paginator = Paginator(cafes, 10)
        results = paginator.get_page(page)
        total_count = paginator.count
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'results': results,
        'query': query,
        'total_count': total_count,
        'user_favorites': user_favorites,
        'current_status': status_filter,
        'current_sort': sort_order,
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/search.html', context)


def cafe_detail_view(request, cafe_id):
    """생일카페 상세 뷰"""
    cafe = get_object_or_404(
        BdayCafe.objects.select_related('artist', 'member').prefetch_related('images'),
        id=cafe_id,
        status='approved'
    )
    
    # 조회수 증가
    try:
        BdayCafe.objects.filter(id=cafe_id).update(view_count=F('view_count') + 1)
        cafe.refresh_from_db()
    except Exception as e:
        logger.warning(f"조회수 업데이트 실패: {e}")
    
    # 사용자 찜 상태 확인
    is_favorited = False
    if request.user.is_authenticated:
        is_favorited = CafeFavorite.objects.filter(
            user=request.user, 
            cafe=cafe
        ).exists()
    
    # ✅ 주변 카페들 (map_utils 사용)
    nearby_cafes = []
    if cafe.latitude and cafe.longitude:
        try:
            approved_cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member')
            nearby_cafes = get_nearby_cafes(
                user_lat=float(cafe.latitude), 
                user_lng=float(cafe.longitude), 
                cafes_queryset=approved_cafes,
                radius_km=5, 
                limit=5, 
                exclude_id=cafe.id
            )
        except (ValueError, TypeError) as e:
            logger.warning(f"주변 카페 조회 오류: {e}")
    
    # 같은 아티스트/멤버의 다른 카페들
    related_cafes = BdayCafe.objects.filter(
        Q(artist=cafe.artist) | Q(member=cafe.member),
        status='approved'
    ).exclude(id=cafe.id).select_related('artist', 'member')[:6]
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    # ✅ 지도 관련 컨텍스트 생성 (map_utils 사용)
    map_context = get_map_context()
    
    context = {
        'cafe': cafe,
        'is_favorited': is_favorited,
        'nearby_cafes': nearby_cafes,
        'related_cafes': related_cafes,
        'user_favorites': user_favorites,
        'is_preview': False,
        'can_edit': False,
        'preview_type': None,
        **map_context,
    }
    
    return render(request, 'ddoksang/detail.html', context)


@cache_page(60 * 5)  # 5분 캐시
def map_view(request):
    """지도 페이지 (별도 지도 전용 페이지)"""
    # ✅ map_utils 사용으로 간소화
    approved_cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member').prefetch_related('images')
    active_cafes = filter_operating_cafes(approved_cafes)
    
    # 지도 관련 컨텍스트 생성 (map_utils 사용)
    map_context = get_map_context(cafes_queryset=active_cafes)
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'active_cafes': active_cafes,
        'user_favorites': user_favorites,
        **map_context,
    }
    
    logger.info(f"지도 페이지 로드: 운영중 카페 {map_context.get('total_cafes', 0)}개")
    
    return render(request, 'ddoksang/map.html', context)


# ✅ 추가: 투어맵 뷰 (cafe_views.py에서 이동)
def tour_map_view(request):
    """투어맵 뷰 - map_utils 사용으로 간소화"""
    from datetime import date
    
    today = date.today()
    
    # ✅ map_utils 사용
    approved_cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member').prefetch_related('images')
    operating_cafes = filter_operating_cafes(approved_cafes, reference_date=today)
    
    logger.info(f"투어맵: 운영중인 카페 수 {operating_cafes.count()}개")
    
    # 지도 관련 컨텍스트 생성 (map_utils 사용)
    map_context = get_map_context(cafes_queryset=operating_cafes)
    
    # 디버깅 정보
    debug_info = {
        "total_queried": operating_cafes.count(),
        "total_valid": map_context.get('total_cafes', 0),
        "today": today.strftime('%Y-%m-%d')
    }
    
    context = {
        **map_context,
        "debug_info": debug_info,
        "total_bday_cafes": map_context.get('total_cafes', 0),  # 템플릿 호환성
        "bday_cafes_json": map_context.get('cafes_json', '[]'),  # 템플릿 호환성
    }
    
    return render(request, 'ddoksang/tour_map.html', context)