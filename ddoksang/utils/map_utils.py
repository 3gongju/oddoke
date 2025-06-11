"""
지도 관련 유틸리티 함수들을 중앙화한 모듈
- 좌표 유효성 검사
- 거리 계산
- 카페 → 지도용 JSON 변환
- 템플릿 컨텍스트 구성
"""

import json
import math
import logging
from typing import List, Dict, Optional, Tuple, Any
from datetime import date

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from ddoksang.models import BdayCafe

logger = logging.getLogger(__name__)

# =====================
# 상수 정의
# =====================
KOREA_BOUNDS = {
    'lat_min': 33.0,
    'lat_max': 43.0,
    'lng_min': 124.0,
    'lng_max': 132.0
}

DEFAULT_CENTER = {
    'lat': 37.5665,
    'lng': 126.9780
}


# =====================
# 클래스 구현부
# =====================
class MapDataGenerator:
    @staticmethod
    def validate_coordinates(latitude: Any, longitude: Any) -> Tuple[bool, Optional[Tuple[float, float]]]:
        try:
            lat = float(latitude)
            lng = float(longitude)

            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                return False, None
            if not (KOREA_BOUNDS['lat_min'] <= lat <= KOREA_BOUNDS['lat_max'] and 
                    KOREA_BOUNDS['lng_min'] <= lng <= KOREA_BOUNDS['lng_max']):
                logger.warning(f"좌표가 한국 범위를 벗어남: {lat}, {lng}")
                return False, None

            return True, (lat, lng)

        except (ValueError, TypeError) as e:
            logger.warning(f"좌표 변환 오류: {e}")
            return False, None

    @staticmethod
    def cafe_to_map_data(cafe) -> Optional[Dict]:
        try:
            is_valid, coords = MapDataGenerator.validate_coordinates(cafe.latitude, cafe.longitude)
            if not is_valid:
                return None
            lat, lng = coords

            main_image_url = None
            try:
                if hasattr(cafe, 'get_main_image') and callable(cafe.get_main_image):
                    main_image_url = cafe.get_main_image()
                elif hasattr(cafe, 'images') and cafe.images.exists():
                    main_image_url = cafe.images.first().image.url
                elif hasattr(cafe, 'main_image') and cafe.main_image:
                    main_image_url = cafe.main_image.url
            except Exception as e:
                logger.warning(f"카페 {cafe.id} 이미지 처리 오류: {e}")

            return {
                'id': cafe.id,
                'name': cafe.cafe_name,
                'cafe_name': cafe.cafe_name,
                'place_name': getattr(cafe, 'place_name', '') or cafe.cafe_name,
                'artist': getattr(cafe.artist, 'display_name', '') if cafe.artist else '',
                'member': getattr(cafe.member, 'member_name', '') if cafe.member else '',
                'latitude': lat,
                'longitude': lng,
                'address': cafe.address or '',
                'road_address': getattr(cafe, 'road_address', '') or '',
                'place_url': f'https://map.kakao.com/link/map/{cafe.cafe_name},{lat},{lng}',
                'start_date': cafe.start_date.strftime('%Y-%m-%d') if cafe.start_date else '',
                'end_date': cafe.end_date.strftime('%Y-%m-%d') if cafe.end_date else '',
                'cafe_type': cafe.get_cafe_type_display() if hasattr(cafe, 'get_cafe_type_display') else '',
                'special_benefits': cafe.special_benefits or '',
                'days_remaining': getattr(cafe, 'days_remaining', 0),
                'main_image': main_image_url,
                'is_active': getattr(cafe, 'is_active', False),
                'view_count': getattr(cafe, 'view_count', 0),
                'images': cafe.get_all_images() if hasattr(cafe, 'get_all_images') else [],
            }

        except Exception as e:
            logger.error(f"카페 {getattr(cafe, 'id', 'unknown')} 지도 데이터 변환 오류: {e}")
            return None

    @staticmethod
    def cafes_to_map_json(cafes_queryset, ensure_ascii=False) -> str:
        map_data = []
        for cafe in cafes_queryset:
            data = MapDataGenerator.cafe_to_map_data(cafe)
            if data:
                map_data.append(data)

        try:
            return json.dumps(map_data, ensure_ascii=ensure_ascii, cls=DjangoJSONEncoder)
        except Exception as e:
            logger.error(f"JSON 직렬화 오류: {e}")
            return "[]"

    @staticmethod
    def get_active_cafes_map_data(status='approved', today=None) -> str:
        if today is None:
            today = date.today()

        cafes = BdayCafe.objects.filter(
            status=status,
            start_date__lte=today,
            end_date__gte=today
        ).select_related('artist', 'member').prefetch_related('images')

        return MapDataGenerator.cafes_to_map_json(cafes)


class DistanceCalculator:
    @staticmethod
    def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        try:
            R = 6371000
            lat1_rad, lng1_rad = math.radians(lat1), math.radians(lng1)
            lat2_rad, lng2_rad = math.radians(lat2), math.radians(lng2)
            dlat = lat2_rad - lat1_rad
            dlng = lng2_rad - lng1_rad

            a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
            return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))
        except (ValueError, TypeError):
            return float('inf')

    @staticmethod
    def calculate_walk_time(distance_meters: float, walking_speed_kmh: float = 4.0) -> int:
        if distance_meters <= 0:
            return 0
        speed_m_per_min = (walking_speed_kmh * 1000) / 60
        return max(1, int(round(distance_meters / speed_m_per_min)))

    @staticmethod
    def get_nearby_cafes(user_lat: float, user_lng: float, cafes_queryset, radius_km=10, limit=10, exclude_id=None):
        try:
            user_lat = float(user_lat)
            user_lng = float(user_lng)
        except (ValueError, TypeError):
            return []

        lat_range = radius_km / 111.0
        lng_range = radius_km / (111.0 * math.cos(math.radians(user_lat)))

        cafes = cafes_queryset.filter(
            latitude__range=(user_lat - lat_range, user_lat + lat_range),
            longitude__range=(user_lng - lng_range, user_lng + lng_range)
        )
        if exclude_id:
            cafes = cafes.exclude(id=exclude_id)

        results = []
        for cafe in cafes:
            try:
                dist = DistanceCalculator.haversine_distance(user_lat, user_lng, cafe.latitude, cafe.longitude)
                if dist <= radius_km * 1000:
                    cafe.distance = dist / 1000
                    cafe.duration = DistanceCalculator.calculate_walk_time(dist)
                    results.append(cafe)
            except:
                continue

        results.sort(key=lambda x: x.distance)
        return results[:limit]


class MapConfigManager:
    @staticmethod
    def get_kakao_api_key() -> str:
        return getattr(settings, 'KAKAO_MAP_API_KEY', '')

    @staticmethod
    def get_default_map_config() -> Dict:
        return {
            'center': DEFAULT_CENTER,
            'level': 8,
            'mobile_level': 9,
            'api_key': MapConfigManager.get_kakao_api_key(),
        }

    @staticmethod
    def get_context_for_template(cafes_queryset=None, user_location=None, **extra_context) -> Dict:
        context = {
            'kakao_api_key': MapConfigManager.get_kakao_api_key(),
            'KAKAO_MAP_API_KEY': MapConfigManager.get_kakao_api_key(),
            'map_config': MapConfigManager.get_default_map_config(),
        }

        if cafes_queryset is not None:
            cafes_json = MapDataGenerator.cafes_to_map_json(cafes_queryset)
            context.update({
                'cafes_json': cafes_json,
                'total_cafes': cafes_queryset.count() if hasattr(cafes_queryset, 'count') else len(cafes_queryset),
                'bday_cafes_json': cafes_json,
                'total_bday_cafes': cafes_queryset.count(),
            })

        if user_location:
            context['user_location'] = user_location

        context.update(extra_context)
        return context


# =====================
# 함수 레벨 래퍼들 (사용 편의성)
# =====================

def validate_coordinates(latitude, longitude):
    return MapDataGenerator.validate_coordinates(latitude, longitude)

def calculate_distance(lat1, lng1, lat2, lng2):
    return DistanceCalculator.haversine_distance(lat1, lng1, lat2, lng2)

def get_nearby_cafes(user_lat, user_lng, cafes_queryset=None, radius_km=10, limit=10, exclude_id=None):
    if cafes_queryset is None:
        today = date.today()
        cafes_queryset = BdayCafe.objects.filter(
            status='approved',
            start_date__lte=today,
            end_date__gte=today
        ).select_related('artist', 'member').prefetch_related('images')

    return DistanceCalculator.get_nearby_cafes(user_lat, user_lng, cafes_queryset, radius_km, limit, exclude_id)

def get_map_context(cafes_queryset=None, **kwargs):
    return MapConfigManager.get_context_for_template(cafes_queryset, **kwargs)

def cafes_to_map_json(cafes_queryset, ensure_ascii=False):
    return MapDataGenerator.cafes_to_map_json(cafes_queryset, ensure_ascii)

def cafe_to_map_data(cafe):
    return MapDataGenerator.cafe_to_map_data(cafe)
