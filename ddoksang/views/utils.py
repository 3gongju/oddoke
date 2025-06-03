from ddoksang.models import BdayCafe, CafeFavorite
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q
from datetime import date
import json
import math
from django.conf import settings

DEFAULT_PAGE_SIZE = getattr(settings, 'DEFAULT_PAGE_SIZE', 10)
MAX_NEARBY_CAFES = getattr(settings, 'MAX_NEARBY_CAFES', 20)

def validate_coordinates(latitude, longitude):
    """위도/경도 유효성 검사"""
    try:
        lat = float(latitude)
        lng = float(longitude)
        
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return False, "좌표가 유효한 범위를 벗어났습니다."
        
        return True, (lat, lng)
    except (ValueError, TypeError):
        return False, "좌표 형식이 올바르지 않습니다."

def get_user_favorites(user):
    """현재 로그인한 유저의 찜한 카페 ID 목록"""
    if user.is_authenticated:
        return set(CafeFavorite.objects.filter(user=user).values_list("cafe_id", flat=True))
    return set()

def get_safe_cafe_map_data(cafes_queryset):
    """카페 쿼리셋을 안전하게 지도용 JSON 데이터로 변환"""
    map_data = []
    
    for cafe in cafes_queryset:
        try:
            cafe_data = cafe.get_kakao_map_data()
            if cafe_data:  # 유효한 좌표가 있는 경우만
                map_data.append(cafe_data)
        except (AttributeError, ValueError, TypeError) as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"카페 {cafe.id} 지도 데이터 생성 오류: {e}")
            continue
    
    return map_data

def calculate_distance(lat1, lng1, lat2, lng2):
    """두 좌표 간의 거리 계산 (km 단위)"""
    try:
        # Haversine 공식
        R = 6371  # 지구 반지름 (km)
        
        lat1_rad = math.radians(float(lat1))
        lng1_rad = math.radians(float(lng1))
        lat2_rad = math.radians(float(lat2))
        lng2_rad = math.radians(float(lng2))
        
        dlat = lat2_rad - lat1_rad
        dlng = lng2_rad - lng1_rad
        
        a = (math.sin(dlat/2) * math.sin(dlat/2) + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(dlng/2) * math.sin(dlng/2))
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        
        return distance
    except (ValueError, TypeError):
        return float('inf')

def get_nearby_cafes(lat, lng, radius_km=10, limit=10, exclude_id=None):
    """주변 생일카페 조회 (거리 계산 포함)"""
    try:
        lat = float(lat)
        lng = float(lng)
    except (ValueError, TypeError):
        return []
    
    # 대략적인 위도/경도 범위 계산 (성능 최적화)
    lat_range = radius_km / 111.0  # 1도 ≈ 111km
    lng_range = radius_km / (111.0 * math.cos(math.radians(lat)))
    
    # 기본 쿼리
    cafes = BdayCafe.objects.filter(
        status='approved',
        latitude__range=(lat - lat_range, lat + lat_range),
        longitude__range=(lng - lng_range, lng + lng_range)
    ).select_related('artist', 'member')
    
    # 특정 카페 제외
    if exclude_id:
        cafes = cafes.exclude(id=exclude_id)
    
    # 거리 계산 및 필터링
    nearby_cafes = []
    for cafe in cafes:
        try:
            distance = calculate_distance(lat, lng, cafe.latitude, cafe.longitude)
            if distance <= radius_km:
                # 도보 시간 추정 (평균 속도 4km/h)
                duration = int(distance * 15)  # 15분/km
                
                cafe.distance = distance
                cafe.duration = duration
                nearby_cafes.append(cafe)
        except (AttributeError, ValueError, TypeError):
            continue
    
    # 거리순 정렬 후 제한
    nearby_cafes.sort(key=lambda x: x.distance)
    return nearby_cafes[:limit]