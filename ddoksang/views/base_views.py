import logging
import json

from datetime import timedelta, date

from django.shortcuts import render, get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.db.models import Q, F
from django.views.decorators.cache import cache_page
from django.core.paginator import Paginator
from django.core.cache import cache
from django.conf import settings

from ddoksang.models import BdayCafe
from ddoksang.utils.favorite_utils import get_user_favorites
from ..utils.cafe_utils import get_cafe_detail_context

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

    # === 1. 이번주 생일 아티스트 ===
    birthday_artists = get_weekly_bday_artists()

    # === 2. 현재 운영중인 생일카페들 (지도용 + 사이드바용) ===
    approved_cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member')
    
    # ✅ 수정: 실제 운영중인 카페만 필터링 (사이드바용)
    active_cafes = approved_cafes.filter(
        start_date__lte=today,
        end_date__gte=today
    ).order_by('-created_at')

    logger.info(f"전체 승인된 카페: {approved_cafes.count()}개, 현재 운영중: {active_cafes.count()}개")

    # === 3. 최신 등록된 카페들 (모든 승인된 카페, 운영 상태 무관) ===
    latest_cafes = approved_cafes.order_by('-created_at')[:6]  # 최신 등록 순으로 6개
    total_latest_cafes_count = approved_cafes.count()

    # === 4. 사용자 찜 목록 ===
    my_favorite_cafes = []
    user_favorites = []
    if request.user.is_authenticated:
        # ManyToManyField 사용
        user_favorites = list(
            request.user.favorite_cafes.values_list('id', flat=True)
        )

        # ManyToManyField 사용한 찜한 카페 목록
        my_favorite_cafes = list(
            request.user.favorite_cafes.filter(
                status='approved'
            ).select_related('artist', 'member').order_by('-id')[:10]
        )

    # === 5. 지도용 데이터 - 운영중인 카페만 사용하되 지도 중심은 서울로 고정 ===
    cafes_json_data = []
    for cafe in active_cafes:  # 운영중인 카페만
        cafe_data = serialize_cafe_for_map(cafe)
        if cafe_data:
            cafes_json_data.append(cafe_data)

    # ✅ 지도 관련 컨텍스트 생성 - 중심점은 서울로 고정
    map_context = get_map_context()  # 카페 데이터 없이 기본 설정만
    map_context.update({
        'cafes_json': cafes_json_data,
        'total_cafes': len(cafes_json_data),
        'default_center': {'lat': 37.5665, 'lng': 126.9780},  # 서울 시청 고정
        'default_zoom': 8,  # 서울 전체가 보이는 줌 레벨
    })

    # === 6. 템플릿 컨텍스트 ===
    context = {
        'birthday_artists': birthday_artists,
        'latest_cafes': latest_cafes,
        'total_latest_cafes_count': total_latest_cafes_count,
        'active_cafes': active_cafes,  # ✅ 실제 운영중인 카페만 (사이드바용)
        'my_favorite_cafes': my_favorite_cafes,
        'user_favorites': user_favorites,
        
        # 지도 관련 (운영중인 카페 데이터 + 서울 중심)
        'cafes_json': cafes_json_data,
        'total_cafes': len(cafes_json_data),
        
        **map_context,  # kakao_api_key, default_center 등 포함
    }
    
    logger.info(f"홈페이지 로드: 운영중 카페 {len(cafes_json_data)}개, 최신 카페 {len(latest_cafes)}개, 사이드바 카페 {active_cafes.count()}개")
    
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
        # 카페 검색 - 아티스트/멤버 정확히 일치
        cafes = BdayCafe.objects.filter(
            Q(artist__display_name__iexact=query) |
            Q(artist__alias__iexact=query) |  
            Q(member__member_name__iexact=query),
            status='approved'
        ).select_related('artist', 'member').distinct()
        
        # 날짜 상태 필터링
        today = timezone.now().date()
        if status_filter == 'ongoing':
            cafes = cafes.filter(start_date__lte=today, end_date__gte=today)
        elif status_filter == 'upcoming':
            cafes = cafes.filter(start_date__gt=today)
        elif status_filter == 'ended':
            cafes = cafes.filter(end_date__lt=today)

        # 정렬 기준 적용
        if sort_order == 'latest':
            cafes = cafes.order_by('-created_at')
        elif sort_order == 'start_date':
            cafes = cafes.order_by('start_date', '-created_at')

        # 페이지네이션
        paginator = Paginator(cafes, 9)
        results = paginator.get_page(page)
        total_count = paginator.count

   # ✅ 첫 번째 결과의 멤버 추출
    member = results[0].member if results and hasattr(results[0], 'member') else None

    cafes_json_data = [serialize_cafe_for_map(c) for c in results if serialize_cafe_for_map(c)]
    user_favorites = get_user_favorites(request.user)

    context = {
        'results': results,
        'query': query,
        'total_count': total_count,
        'user_favorites': user_favorites,
        'current_status': status_filter,
        'current_sort': sort_order,
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        'cafes_json': cafes_json_data,
        'member': member,  # 템플릿에서 사용 가능하도록 추가
    }

    return render(request, 'ddoksang/search.html', context)




# 최신 본 글 저장
def cafe_detail_view(request, cafe_id):
    """생일카페 상세 뷰"""
    cafe = get_object_or_404(
        BdayCafe.objects.select_related('artist', 'member'),
        id=cafe_id,
        status='approved'
    )
        
    # 조회수 증가
    try:
        BdayCafe.objects.filter(id=cafe_id).update(view_count=F('view_count') + 1)
        cafe.refresh_from_db()
    except Exception as e:
        logger.warning(f"조회수 업데이트 실패: {e}")
    
    # ✅ 쿠키에서 최근 본 카페 목록 가져오기
    recent_cafes = get_recent_cafes_from_cookie(request)
    
    # ✅ 현재 카페를 최근 본 카페 목록에 추가
    recent_cafes = add_cafe_to_recent(recent_cafes, cafe_id)
    
    # 디버깅: 카페 정보 확인
    logger.info(f"카페 상세 조회: {cafe.cafe_name} (ID: {cafe.id})")
    logger.info(f"카페 아티스트: {cafe.artist.display_name if cafe.artist else 'None'}")
    logger.info(f"카페 멤버: {cafe.member.member_name if cafe.member else 'None'}")
    logger.info(f"카페 좌표: ({cafe.latitude}, {cafe.longitude})")
    
    # 주변 카페들 (map_utils 사용)
    nearby_cafes = []
    if cafe.latitude and cafe.longitude:
        try:
            approved_cafes = BdayCafe.objects.filter(status='approved', member=cafe.member).select_related('artist', 'member')
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

    # 현재 카페가 찜 목록에 있는지 확인
    is_favorited = cafe.id in user_favorites if user_favorites else False
    
    # 지도 관련 컨텍스트 생성 (map_utils 사용)
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
        'settings': settings,
        **map_context,
    }
    
    # ✅ 응답 생성
    response = render(request, 'ddoksang/detail.html', context)
    
    # ✅ 쿠키에 최근 본 카페 저장 (30일 유지)
    response.set_cookie(
        'recent_cafes', 
        json.dumps(recent_cafes),
        max_age=30*24*3600,  # 30일
        httponly=True,  # XSS 보안
        samesite='Lax'  # CSRF 보안
    )
    
    return response


def get_recent_cafes_from_cookie(request):
    """쿠키에서 최근 본 카페 목록 가져오기"""
    try:
        recent_cafes_str = request.COOKIES.get('recent_cafes', '[]')
        recent_cafes = json.loads(recent_cafes_str)
        
        # 유효성 검사: 리스트이고, 숫자들로만 구성되어야 함
        if isinstance(recent_cafes, list):
            return [int(cafe_id) for cafe_id in recent_cafes if str(cafe_id).isdigit()]
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    
    return []


def add_cafe_to_recent(recent_cafes, new_cafe_id):
    """최근 본 카페 목록에 새 카페 추가"""
    new_cafe_id = int(new_cafe_id)
    
    # 이미 목록에 있으면 제거 (맨 앞으로 이동하기 위해)
    if new_cafe_id in recent_cafes:
        recent_cafes.remove(new_cafe_id)
    
    # 맨 앞에 추가
    recent_cafes.insert(0, new_cafe_id)
    
    # 최대 10개까지만 유지
    return recent_cafes[:10]


def get_recent_cafes_objects(request):
    """쿠키에서 최근 본 카페 객체들 가져오기 (템플릿에서 사용)"""
    recent_cafe_ids = get_recent_cafes_from_cookie(request)
    
    if not recent_cafe_ids:
        return []
    
    # DB에서 카페 객체들 가져오기 (순서 유지)
    cafes = BdayCafe.objects.filter(
        id__in=recent_cafe_ids,
        status='approved'
    ).select_related('artist', 'member')
    
    # 쿠키의 순서대로 정렬
    cafe_dict = {cafe.id: cafe for cafe in cafes}
    return [cafe_dict[cafe_id] for cafe_id in recent_cafe_ids if cafe_id in cafe_dict]
    
 
#  추가: 투어맵 뷰 (cafe_views.py에서 이동)
def tour_map_view(request):
    """투어맵 뷰 - map_utils 사용으로 간소화"""
    from datetime import date
    
    today = date.today()
    
    #  map_utils 사용
    approved_cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member')
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