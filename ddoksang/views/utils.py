# ddoksang/views/utils.py
# 공통 유틸리티 함수들

import math
import logging
from django.conf import settings
from django.contrib.auth.decorators import user_passes_test
from django.core.cache import cache

from ..models import CafeFavorite, BdayCafe

logger = logging.getLogger(__name__)

# 상수 정의
NEARBY_CAFE_RADIUS = getattr(settings, 'NEARBY_CAFE_RADIUS', 5)
WALKING_SPEED_KMPH = getattr(settings, 'WALKING_SPEED_KMPH', 5)
DEFAULT_PAGE_SIZE = getattr(settings, 'DEFAULT_PAGE_SIZE', 10)
MAX_NEARBY_CAFES = getattr(settings, 'MAX_NEARBY_CAFES', 50)

def admin_required(view_func):
    """관리자 권한 필요 데코레이터"""
    return user_passes_test(lambda u: u.is_superuser or u.is_staff)(view_func)

def get_user_favorites(user):
    """사용자 찜 목록 조회"""
    if user.is_authenticated:
        return list(CafeFavorite.objects.filter(user=user).values_list('cafe_id', flat=True))
    return []

def validate_coordinates(lat, lng):
    """좌표 유효성 검증"""
    try:
        lat_float = float(lat)
        lng_float = float(lng)
        
        if not (-90 <= lat_float <= 90):
            return False, "위도는 -90도에서 90도 사이여야 합니다."
        if not (-180 <= lng_float <= 180):
            return False, "경도는 -180도에서 180도 사이여야 합니다."
        
        return True, (lat_float, lng_float)
    except (ValueError, TypeError):
        return False, "잘못된 좌표 형식입니다."

def calculate_distance(lat1, lon1, lat2, lon2):
    """두 지점 간 거리 계산 (하버사인 공식)"""
    try:
        R = 6371  # 지구 반지름 (km)
        lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
        lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    except (ValueError, TypeError) as e:
        logger.warning(f"거리 계산 오류: {e}")
        return 0

def get_nearby_cafes(center_lat, center_lng, radius_km=None, exclude_id=None, limit=None):
    """주변 생일카페 조회 (최적화된 버전)"""
    if radius_km is None:
        radius_km = NEARBY_CAFE_RADIUS
    if limit is None:
        limit = DEFAULT_PAGE_SIZE
        
    # 캐시 키 생성
    cache_key = f"nearby_cafes_{center_lat}_{center_lng}_{radius_km}_{exclude_id}_{limit}"
    cached_result = cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # 기본 쿼리 최적화
    base_query = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member').only(
        'id', 'cafe_name', 'latitude', 'longitude', 'start_date', 'end_date',
        'address', 'special_benefits', 'artist__display_name', 'member__member_name'
    )
    
    if exclude_id:
        base_query = base_query.exclude(id=exclude_id)
    
    nearby_cafes = []
    
    try:
        for cafe in base_query:
            if not (cafe.latitude and cafe.longitude):
                continue
                
            distance = calculate_distance(
                center_lat, center_lng,
                float(cafe.latitude), float(cafe.longitude)
            )
            
            if distance <= radius_km:
                cafe.distance = distance
                # 도보 시간 계산 (분 단위)
                cafe.duration = max(1, int(distance * 60 / WALKING_SPEED_KMPH))
                nearby_cafes.append(cafe)
    
    except Exception as e:
        logger.error(f"주변 카페 조회 중 오류: {e}")
        return []
    
    # 거리순 정렬 후 제한
    nearby_cafes.sort(key=lambda x: x.distance)
    result = nearby_cafes[:limit]
    
    # 캐시 저장 (5분)
    cache.set(cache_key, result, 300)
    return result

def get_safe_cafe_map_data(cafes):
    """안전한 카페 지도 데이터 생성"""
    cafes_data = []
    for cafe in cafes:
        try:
            cafe_data = cafe.get_kakao_map_data()
            # 필수 데이터 검증
            if (cafe_data.get('latitude') and cafe_data.get('longitude') and 
                isinstance(cafe_data['latitude'], (int, float)) and 
                isinstance(cafe_data['longitude'], (int, float))):
                cafes_data.append(cafe_data)
        except (AttributeError, ValueError, TypeError) as e:
            logger.warning(f"카페 {cafe.id} 지도 데이터 생성 오류: {e}")
            continue
        except Exception as e:
            logger.error(f"카페 {cafe.id} 예상치 못한 오류: {e}")
            continue
    
    return cafes_data