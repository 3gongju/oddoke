# ddoksang/views/base_views.py
# 기본 뷰들 (홈, 상세보기, 검색, 지도) - 새로운 레이아웃 적용

import logging
from datetime import timedelta, date

from django.shortcuts import render, get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.db.models import Q, F
from django.views.decorators.cache import cache_page
from django.core.paginator import Paginator
from django.core.cache import cache

from ..models import BdayCafe, CafeFavorite
from ..utils.map_utils import get_map_context, get_nearby_cafes
from artist.models import Artist, Member
from .utils import get_user_favorites
from ..utils.bday_utils import get_weekly_bday_artists




logger = logging.getLogger(__name__)


def home_view(request):
    """홈 뷰 - 지도 + 현재 운영중인 카페 리스트 + 생일 멤버"""
    today = timezone.now().date()
    today_str = today.strftime('%m-%d')

    birthday_artists = get_weekly_bday_artists

    # === 2. 현재 운영중인 생일카페들 (지도용) ===
    active_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member').prefetch_related('images').order_by('-created_at')

    # === 3. ✅ 최신 등록된 카페들 (모든 승인된 카페) ===
    latest_cafes = BdayCafe.objects.filter(
        status='approved'  # 운영 상태와 관계없이 승인된 모든 카페
    ).select_related('artist', 'member').prefetch_related('images') \
     .order_by('-created_at')[:6]  # 최신 등록 순으로 6개

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
        .order_by('-created_at')[:10]  # 찜한 카페도 최대 10개

        my_favorite_cafes = [fav.cafe for fav in favorites]

    # === 5. 지도 관련 컨텍스트 생성 (현재 운영중인 카페들만) ===
    map_context = get_map_context(cafes_queryset=active_cafes)

    # === 6. 템플릿 컨텍스트 ===
    context = {
        'birthday_artists': birthday_artists,
        'latest_cafes': latest_cafes,  # ✅ 모든 승인된 카페 중 최신 6개
        'active_cafes': active_cafes,  # 지도용 (현재 운영중)
        'my_favorite_cafes': my_favorite_cafes,
        'user_favorites': user_favorites,
        **map_context,  # 지도 관련 컨텍스트 (현재 운영중인 카페들)
    }
    
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
        
        # ✅ 간단한 상태 필터링
        today = timezone.now().date()
        
        if status_filter == 'ongoing':
            cafes = cafes.filter(start_date__lte=today, end_date__gte=today)
        elif status_filter == 'upcoming':
            cafes = cafes.filter(start_date__gt=today)
        elif status_filter == 'ended':
            cafes = cafes.filter(end_date__lt=today)
        # status_filter가 없으면 전체
        
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
        'current_status': status_filter,  # 템플릿에서 사용
        'current_sort': sort_order,
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
    
    # 주변 카페들 (5km 이내) - 유틸리티 사용
    nearby_cafes = []
    if cafe.latitude and cafe.longitude:
        try:
            # 승인된 카페들 중에서 주변 카페 검색
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
    
    # 같은 아티스트/멤버의 다른 카페들 (related_cafes로 유지)
    related_cafes = BdayCafe.objects.filter(
        Q(artist=cafe.artist) | Q(member=cafe.member),
        status='approved'
    ).exclude(id=cafe.id).select_related('artist', 'member')[:6]
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    # 지도 관련 컨텍스트 생성
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
        **map_context,  # 지도 관련 컨텍스트 병합
    }
    
    return render(request, 'ddoksang/detail.html', context)


@cache_page(60 * 5)  # 5분 캐시
def map_view(request):
    """지도 페이지 (별도 지도 전용 페이지)"""
    today = timezone.now().date()
    
    # 현재 운영중인 카페들
    active_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member').prefetch_related('images')
    
    # 지도 관련 컨텍스트 생성 (유틸리티 사용)
    map_context = get_map_context(cafes_queryset=active_cafes)
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'active_cafes': active_cafes,
        'user_favorites': user_favorites,
        **map_context,  # 지도 관련 컨텍스트 병합
    }
    
    return render(request, 'ddoksang/map.html', context)