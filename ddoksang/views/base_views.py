# ddoksang/views/base_views.py
# 기본 뷰들 (홈, 상세보기, 검색, 지도)

import json
from datetime import timedelta

from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Q, F
from django.views.decorators.cache import cache_page
from django.core.paginator import Paginator
from django.core.cache import cache
from django.conf import settings

from ..models import BdayCafe, CafeFavorite
from artist.models import Artist, Member
from .utils import get_user_favorites, get_nearby_cafes, get_safe_cafe_map_data



def home_view(request):
    """홈 뷰 - 위치 기반 서비스 포함"""
    today = timezone.now().date()
    
    # === 기존 생일 아티스트 로직 유지 ===
    today_str = today.strftime('%m-%d')
    
    upcoming_dates = []
    for i in range(7):
        date = today + timedelta(days=i)
        upcoming_dates.append(date.strftime('%m-%d'))
    
    birthday_members = Member.objects.filter(
        member_bday__in=upcoming_dates
    ).select_related().prefetch_related('artist_name')
    
    birthday_artists = []
    for member in birthday_members:
        artists = member.artist_name.all()
        if artists:
            artist = artists[0]
            
            is_today_birthday = member.member_bday == today_str
            
            try:
                member_month, member_day = map(int, member.member_bday.split('-'))
                this_year_birthday = today.replace(month=member_month, day=member_day)
                
                if this_year_birthday < today:
                    next_year_birthday = this_year_birthday.replace(year=today.year + 1)
                    days_until_birthday = (next_year_birthday - today).days
                else:
                    days_until_birthday = (this_year_birthday - today).days
                    
            except (ValueError, TypeError):
                days_until_birthday = 999
            
            display_artist_name = artist.display_name
            if member.member_name.lower() == artist.display_name.lower():
                display_artist_name = ""
            
            birthday_artists.append({
                'member_name': member.member_name,
                'artist_name': display_artist_name,
                'artist_display_name': artist.display_name,
                'birthday_display': member.member_bday,
                'profile_image': getattr(member, 'profile_image', None),
                'is_today_birthday': is_today_birthday,
                'days_until_birthday': days_until_birthday,
                'member': member,
            })
    
    birthday_artists.sort(key=lambda x: (
        not x['is_today_birthday'],
        x['days_until_birthday'],
        x['member_name']
    ))
   
    # === 최신 등록된 카페 ===
    latest_cafes = cache.get('latest_cafes')
    if not latest_cafes:
        latest_cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member').prefetch_related('images').order_by('-created_at')[:3]
        cache.set('latest_cafes', latest_cafes, 300)
    
    # === 내가 찜한 아티스트/멤버의 생일카페 ===
    my_favorite_cafes = []
    if request.user.is_authenticated:
        favorited_cafes = CafeFavorite.objects.filter(user=request.user).select_related('cafe__artist', 'cafe__member')
        
        favorited_artist_ids = set()
        favorited_member_ids = set()
        
        for fav in favorited_cafes:
            if fav.cafe.artist_id:
                favorited_artist_ids.add(fav.cafe.artist_id)
            if fav.cafe.member_id:
                favorited_member_ids.add(fav.cafe.member_id)
        
        if favorited_artist_ids or favorited_member_ids:
            my_favorite_cafes_query = BdayCafe.objects.filter(
                status='approved'
            ).select_related('artist', 'member').prefetch_related('images')
            
            if favorited_artist_ids and favorited_member_ids:
                my_favorite_cafes_query = my_favorite_cafes_query.filter(
                    Q(artist_id__in=favorited_artist_ids) | Q(member_id__in=favorited_member_ids)
                )
            elif favorited_artist_ids:
                my_favorite_cafes_query = my_favorite_cafes_query.filter(artist_id__in=favorited_artist_ids)
            elif favorited_member_ids:
                my_favorite_cafes_query = my_favorite_cafes_query.filter(member_id__in=favorited_member_ids)
            
            my_favorite_cafes = my_favorite_cafes_query.order_by('-created_at')[:10]
    
    # === 현재 운영중인 생일카페들 ===
    active_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member').prefetch_related('images')
    
    # === 안전한 지도 데이터 생성 ===
    cafes_json_data = []
    for cafe in active_cafes:
        try:
            main_image_url = cafe.get_main_image()
            
            cafe_data = {
                'id': cafe.id,
                'name': cafe.cafe_name,
                'artist': cafe.artist.display_name,
                'member': cafe.member.member_name if cafe.member else None,
                'latitude': float(cafe.latitude) if cafe.latitude else None,
                'longitude': float(cafe.longitude) if cafe.longitude else None,
                'address': cafe.address or '',
                'road_address': cafe.road_address or '',
                'start_date': cafe.start_date.strftime('%Y-%m-%d'),
                'end_date': cafe.end_date.strftime('%Y-%m-%d'),
                'is_active': cafe.is_active,
                'days_remaining': cafe.days_remaining,
                'main_image': main_image_url,
                'special_benefits': cafe.special_benefits or '',
                'cafe_type': cafe.get_cafe_type_display(),
            }
            
            if (cafe_data['latitude'] and cafe_data['longitude'] and 
                isinstance(cafe_data['latitude'], (int, float)) and 
                isinstance(cafe_data['longitude'], (int, float))):
                cafes_json_data.append(cafe_data)
                
        except (AttributeError, ValueError, TypeError) as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"카페 {cafe.id} 지도 데이터 생성 오류: {e}")
            continue
    
    cafes_json = json.dumps(cafes_json_data, ensure_ascii=False)
    
    # === ✅ 사용자 찜 목록 개선 ===
    user_favorites = []
    if request.user.is_authenticated:
        user_favorites = list(CafeFavorite.objects.filter(
            user=request.user
        ).values_list('cafe_id', flat=True))

    context = {
        'birthday_artists': birthday_artists,
        'latest_cafes': latest_cafes,
        'my_favorite_cafes': my_favorite_cafes,
        'cafes_json': cafes_json,
        'total_cafes': len(cafes_json_data),
        'user_favorites': json.dumps(user_favorites),  # ✅ JSON으로 직렬화
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/home.html', context)


def search_view(request):
    """통합 검색 페이지"""
    query = request.GET.get('q', '').strip()
    page = request.GET.get('page', 1)
    
    results = []
    total_count = 0
    
    if query and len(query) >= 2:
        # 카페 검색 - 아티스트/멤버만
        cafes = BdayCafe.objects.filter(
            Q(artist__display_name__icontains=query) |
            Q(member__member_name__icontains=query),
            status='approved'
        ).select_related('artist', 'member').distinct()
        
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
    }
    return render(request, 'ddoksang/search.html', context)


def cafe_detail_view(request, cafe_id):
    """생일카페 상세 뷰"""
    cafe = get_object_or_404(
        BdayCafe.objects.select_related('artist', 'member').prefetch_related('images'),
        id=cafe_id,
        status='approved'
    )
    
    # 사용자 찜 상태 확인
    is_favorited = False
    if request.user.is_authenticated:
        is_favorited = CafeFavorite.objects.filter(
            user=request.user, 
            cafe=cafe
        ).exists()
    
    # 같은 아티스트/멤버의 다른 카페들
    related_cafes = BdayCafe.objects.filter(
        Q(artist=cafe.artist) | Q(member=cafe.member),
        status='approved'
    ).exclude(id=cafe.id).select_related('artist', 'member')[:6]
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'cafe': cafe,
        'is_favorited': is_favorited,
        'related_cafes': related_cafes,
        'user_favorites': user_favorites,
    }
    
    return render(request, 'ddoksang/detail.html', context)


@cache_page(60 * 5)  # 5분 캐시
def map_view(request):
    """지도 페이지"""
    today = timezone.now().date()
    
    # 현재 운영중인 카페들
    active_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member').prefetch_related('images')
    
    # 안전한 지도 데이터 생성
    cafes_json = get_safe_cafe_map_data(active_cafes)
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'active_cafes': active_cafes,
        'cafes_json': cafes_json,
        'user_favorites': user_favorites,
        'KAKAO_MAP_API_KEY': settings.KAKAO_MAP_API_KEY,  # API 키 직접 전달
    }
    
    return render(request, 'ddoksang/map.html', context)

def bday_cafe_detail(request, cafe_id):
    """생일카페 상세 페이지"""
    cafe = get_object_or_404(BdayCafe, id=cafe_id, status='approved')
    is_favorited = False
    
    if request.user.is_authenticated:
        is_favorited = CafeFavorite.objects.filter(user=request.user, cafe=cafe).exists()
        # 조회수 증가 (원자적 연산)
        BdayCafe.objects.filter(id=cafe_id).update(view_count=F('view_count') + 1)
    
    # 주변 생일카페 조회
    nearby_cafes = []
    if cafe.latitude and cafe.longitude:
        try:
            from .utils import get_nearby_cafes
            nearby_cafes = get_nearby_cafes(
                float(cafe.latitude), 
                float(cafe.longitude), 
                exclude_id=cafe.id,
                limit=5
            )
        except (ValueError, TypeError) as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"주변 카페 조회 오류: {e}")
    
    # ✅ 사용자 찜 목록 (리스트로)
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'cafe': cafe,
        'is_favorited': is_favorited,
        'nearby_cafes': nearby_cafes,
        'user_favorites': json.dumps(user_favorites),  # JSON으로 직렬화
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/detail.html', context)


def cafe_list_view(request):
    """카페 목록 페이지"""
    page = request.GET.get('page', 1)
    search = request.GET.get('search', '')
    artist_filter = request.GET.get('artist', '')
    status_filter = request.GET.get('status', 'active')
    sort_by = request.GET.get('sort', 'latest')
    
    today = timezone.now().date()
    
    # 기본 쿼리
    cafes = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member')
    
    # 상태별 필터링
    if status_filter == 'active':
        cafes = cafes.filter(start_date__lte=today, end_date__gte=today)
    elif status_filter == 'upcoming':
        cafes = cafes.filter(start_date__gt=today)
    elif status_filter == 'ended':
        cafes = cafes.filter(end_date__lt=today)
    
    # 검색 필터링
    if search:
        cafes = cafes.filter(
            Q(artist__display_name__icontains=search) |
            Q(member__member_name__icontains=search)
        )
        
    # 아티스트 필터링
    if artist_filter:
        cafes = cafes.filter(artist_id=artist_filter)
    
    # 정렬
    if sort_by == 'popularity':
        cafes = cafes.order_by('-view_count', '-created_at')
    elif sort_by == 'ending_soon':
        cafes = cafes.filter(end_date__gte=today).order_by('end_date')
    else:  # latest
        cafes = cafes.order_by('-created_at')
    
    # 페이징 처리
    paginator = Paginator(cafes, 12)
    cafes_page = paginator.get_page(page)
    
    # 아티스트 목록
    artists = Artist.objects.filter(
        bdaycafe__status='approved'
    ).distinct().order_by('display_name')
    
    # ✅ 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'cafes': cafes_page,
        'artists': artists,
        'user_favorites': json.dumps(user_favorites),  # JSON으로 직렬화
        'search': search,
        'artist_filter': artist_filter,
        'status_filter': status_filter,
        'sort_by': sort_by,
        'total_count': paginator.count,
    }
    return render(request, 'ddoksang/cafe_list.html', context)


def search_view(request):
    """통합 검색 페이지"""
    query = request.GET.get('q', '').strip()
    page = request.GET.get('page', 1)
    
    results = []
    
    if query and len(query) >= 2:
        # 카페 검색
        cafes = BdayCafe.objects.filter(
            Q(artist__display_name__icontains=query) |
            Q(member__member_name__icontains=query),
            status='approved'
        ).select_related('artist', 'member').distinct()
        
        # 페이징 처리
        paginator = Paginator(cafes, 10)
        results = paginator.get_page(page)
    
    # ✅ 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'results': results,
        'query': query,
        'user_favorites': json.dumps(user_favorites),  # JSON으로 직렬화
    }
    return render(request, 'ddoksang/search.html', context)
