# ddoksang/views/base_views.py
# 기본 뷰들 (홈, 상세보기, 검색, 지도)

import json
import logging
from datetime import timedelta

from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Q
from django.views.decorators.cache import cache_page
from django.core.paginator import Paginator
from django.core.cache import cache
from django.conf import settings

from ..models import BdayCafe, CafeFavorite
from artist.models import Artist, Member
from .utils import get_user_favorites, get_nearby_cafes, get_safe_cafe_map_data

logger = logging.getLogger(__name__)


def home_view(request):
    """홈 뷰 - 생일 멤버 + 최신 생카 + 찜한 생카 + 지도 데이터 통합"""
    today = timezone.now().date()
    today_str = today.strftime('%m-%d')

    # === 1. 생일 멤버 계산 ===
    upcoming_dates = [(today + timedelta(days=i)).strftime('%m-%d') for i in range(7)]
    birthday_members = Member.objects.filter(member_bday__in=upcoming_dates).select_related().prefetch_related('artist_name')

    birthday_artists = []
    for member in birthday_members:
        artists = member.artist_name.all()
        if not artists:
            continue
        artist = artists[0]
        is_today_birthday = member.member_bday == today_str
        try:
            month, day = map(int, member.member_bday.split('-'))
            this_year_birthday = today.replace(month=month, day=day)
            if this_year_birthday < today:
                next_birthday = this_year_birthday.replace(year=today.year + 1)
                days_until = (next_birthday - today).days
            else:
                days_until = (this_year_birthday - today).days
        except:
            days_until = 999

        display_artist = "" if member.member_name.lower() == artist.display_name.lower() else artist.display_name

        birthday_artists.append({
            'member_name': member.member_name,
            'artist_name': display_artist,
            'artist_display_name': artist.display_name,
            'birthday_display': member.member_bday,
            'profile_image': getattr(member, 'profile_image', None),
            'is_today_birthday': is_today_birthday,
            'days_until_birthday': days_until,
            'member': member,
        })

    birthday_artists.sort(key=lambda x: (not x['is_today_birthday'], x['days_until_birthday'], x['member_name']))

    # === 2. 최신 승인된 생일카페 (캐시 5분) ===
    latest_cafes = cache.get('latest_cafes')
    if not latest_cafes:
        latest_cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member').prefetch_related('images').order_by('-created_at')[:6]
        cache.set('latest_cafes', latest_cafes, 300)

    # === 3. 사용자 찜 목록 ===
    my_favorite_cafes = []
    user_favorites = []
    if request.user.is_authenticated:
        user_favorites = list(
            CafeFavorite.objects.filter(user=request.user)
            .values_list('cafe_id', flat=True)
        )
        if user_favorites:
            my_favorite_cafes = BdayCafe.objects.filter(
                id__in=user_favorites,
                status='approved'
            ).select_related('artist', 'member').prefetch_related('images').order_by('-created_at')[:10]

    # === 4. 현재 운영 중인 생카 지도용 JSON 데이터 ===
    active_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member').prefetch_related('images')

    cafes_json_data = []
    for cafe in active_cafes:
        try:
            if not cafe.latitude or not cafe.longitude:
                continue
            lat = float(cafe.latitude)
            lng = float(cafe.longitude)
            if not (33.0 <= lat <= 43.0 and 124.0 <= lng <= 132.0):
                continue
            main_image_url = None
            try:
                if hasattr(cafe, 'get_main_image'):
                    main_image_url = cafe.get_main_image()
                elif cafe.images.exists():
                    main_image_url = cafe.images.first().image.url
            except Exception:
                pass

            cafe_data = {
                'id': cafe.id,
                'name': cafe.cafe_name,
                'cafe_name': cafe.cafe_name,
                'artist': cafe.artist.display_name if cafe.artist else '',
                'member': cafe.member.member_name if cafe.member else '',
                'latitude': lat,
                'longitude': lng,
                'address': cafe.address or '',
                'road_address': cafe.road_address or '',
                'start_date': cafe.start_date.strftime('%Y-%m-%d'),
                'end_date': cafe.end_date.strftime('%Y-%m-%d'),
                'is_active': True,
                'days_remaining': (cafe.end_date - today).days,
                'main_image': main_image_url,
                'special_benefits': cafe.special_benefits or '',
                'cafe_type': cafe.get_cafe_type_display(),
            }
            cafes_json_data.append(cafe_data)
        except Exception as e:
            logger.warning(f"지도용 카페 데이터 오류 - ID {cafe.id}: {e}")
            continue

    cafes_json = json.dumps(cafes_json_data, ensure_ascii=False)

    # === 5. 템플릿 렌더 ===
    context = {
        'birthday_artists': birthday_artists,
        'latest_cafes': latest_cafes,
        'my_favorite_cafes': my_favorite_cafes,
        'user_favorites': user_favorites,
        'cafes_json': cafes_json,
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        'KAKAO_MAP_API_KEY': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        'total_cafes': len(cafes_json_data),

        # 호환성 유지
        'bday_cafes_json': cafes_json,
        'total_bday_cafes': len(cafes_json_data),
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