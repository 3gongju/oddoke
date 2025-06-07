# ddoksang/utils/map_utils.py
"""
지도 관련 유틸리티 함수들을 중앙화한 모듈
- 카페 데이터를 지도용 JSON으로 변환
- 좌표 유효성 검증
- 거리 계산 등
"""

import json
import math
import logging
from typing import List, Dict, Optional, Tuple, Any, Union
from datetime import date
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder

logger = logging.getLogger(__name__)

# 상수 정의
KOREA_BOUNDS = {
    'lat_min': 33.0,
    'lat_max': 43.0,
    'lng_min': 124.0,
    'lng_max': 132.0
}

DEFAULT_CENTER = {
    'lat': 37.5665,  # 서울 시청
    'lng': 126.9780
}

class MapDataGenerator:
    """지도 데이터 생성을 담당하는 클래스"""
    
    @staticmethod
    def validate_coordinates(latitude: Any, longitude: Any) -> Tuple[bool, Optional[Tuple[float, float]]]:
        """좌표 유효성 검사"""
        try:
            lat = float(latitude)
            lng = float(longitude)
            
            # 기본 범위 검사
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                return False, None
            
            # 한국 좌표 범위 검사
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
        """개별 카페를 지도용 데이터로 변환 (models.py의 get_kakao_map_data를 대체)"""
        try:
            # 좌표 검증
            is_valid, coords = MapDataGenerator.validate_coordinates(cafe.latitude, cafe.longitude)
            if not is_valid:
                return None
            
            lat, lng = coords
            
            # 메인 이미지 URL 가져오기
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
            
            # 카페 데이터 구조 (기존 get_kakao_map_data와 동일한 구조 유지)
            return {
                'id': cafe.id,
                'name': cafe.cafe_name,
                'cafe_name': cafe.cafe_name,  # 하위 호환성
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
        """카페 쿼리셋을 지도용 JSON 문자열로 변환"""
        map_data = []
        error_count = 0
        
        for cafe in cafes_queryset:
            cafe_data = MapDataGenerator.cafe_to_map_data(cafe)
            if cafe_data:
                map_data.append(cafe_data)
            else:
                error_count += 1
        
        if error_count > 0:
            logger.info(f"지도 데이터 변환 완료: 성공 {len(map_data)}개, 실패 {error_count}개")
        
        try:
            return json.dumps(map_data, ensure_ascii=ensure_ascii, cls=DjangoJSONEncoder)
        except Exception as e:
            logger.error(f"JSON 직렬화 오류: {e}")
            return "[]"
    
    @staticmethod
    def get_active_cafes_map_data(status='approved', today=None) -> str:
        """현재 운영중인 카페들의 지도 데이터 반환"""
        from ..models import BdayCafe
        
        if today is None:
            today = date.today()
        
        cafes = BdayCafe.objects.filter(
            status=status,
            start_date__lte=today,
            end_date__gte=today
        ).select_related('artist', 'member').prefetch_related('images')
        
        return MapDataGenerator.cafes_to_map_json(cafes)


class MapConfigManager:
    """지도 설정 관리 클래스"""
    
    @staticmethod
    def get_kakao_api_key() -> str:
        """카카오맵 API 키 반환"""
        return getattr(settings, 'KAKAO_MAP_API_KEY', '')
    
    @staticmethod
    def get_default_map_config() -> Dict:
        """기본 지도 설정 반환"""
        return {
            'center': DEFAULT_CENTER,
            'level': 8,
            'mobile_level': 9,
            'api_key': MapConfigManager.get_kakao_api_key(),
        }
    
    @staticmethod
    def get_context_for_template(cafes_queryset=None, user_location=None, **extra_context) -> Dict:
        """템플릿에서 사용할 지도 관련 컨텍스트 반환"""
        context = {
            'kakao_api_key': MapConfigManager.get_kakao_api_key(),
            'KAKAO_MAP_API_KEY': MapConfigManager.get_kakao_api_key(),  # 하위 호환성
            'map_config': MapConfigManager.get_default_map_config(),
        }
        
        if cafes_queryset is not None:
            cafes_json = MapDataGenerator.cafes_to_map_json(cafes_queryset)
            total_count = cafes_queryset.count() if hasattr(cafes_queryset, 'count') else len(cafes_queryset)
            
            context.update({
                'cafes_json': cafes_json,
                'total_cafes': total_count,
                # 하위 호환성
                'bday_cafes_json': cafes_json,
                'total_bday_cafes': total_count,
            })
        
        if user_location:
            context['user_location'] = user_location
        
        # 추가 컨텍스트 병합
        context.update(extra_context)
        
        return context


class DistanceCalculator:
    """거리 계산 관련 유틸리티"""
    
    @staticmethod
    def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Haversine 공식을 사용한 두 좌표 간의 거리 계산 (미터 단위)"""
        try:
            R = 6371000  # 지구 반지름 (미터)
            
            lat1_rad = math.radians(lat1)
            lng1_rad = math.radians(lng1)
            lat2_rad = math.radians(lat2)
            lng2_rad = math.radians(lng2)
            
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
    
    @staticmethod
    def calculate_walk_time(distance_meters: float, walking_speed_kmh: float = 4.0) -> int:
        """거리(미터)를 기반으로 도보 시간(분) 계산"""
        if distance_meters <= 0:
            return 0
        
        # km/h를 m/min로 변환
        speed_m_per_min = (walking_speed_kmh * 1000) / 60
        walk_time_minutes = distance_meters / speed_m_per_min
        
        return max(1, int(round(walk_time_minutes)))
    
    @staticmethod
    def get_nearby_cafes(user_lat: float, user_lng: float, cafes_queryset, 
                        radius_km: float = 10, limit: int = 10, exclude_id=None):
        """주변 생일카페 조회 (거리 계산 포함)"""
        try:
            user_lat = float(user_lat)
            user_lng = float(user_lng)
        except (ValueError, TypeError):
            return []
        
        # 대략적인 위도/경도 범위 계산 (성능 최적화)
        lat_range = radius_km / 111.0  # 1도 ≈ 111km
        lng_range = radius_km / (111.0 * math.cos(math.radians(user_lat)))
        
        # 기본 쿼리 (좌표 범위로 1차 필터링)
        cafes = cafes_queryset.filter(
            latitude__range=(user_lat - lat_range, user_lat + lat_range),
            longitude__range=(user_lng - lng_range, user_lng + lng_range)
        )
        
        # 특정 카페 제외
        if exclude_id:
            cafes = cafes.exclude(id=exclude_id)
        
        # 거리 계산 및 필터링
        nearby_cafes = []
        for cafe in cafes:
            try:
                distance = DistanceCalculator.haversine_distance(
                    user_lat, user_lng, float(cafe.latitude), float(cafe.longitude)
                )
                
                if distance <= radius_km * 1000:  # km를 m로 변환
                    # 도보 시간 계산
                    duration = DistanceCalculator.calculate_walk_time(distance)
                    
                    # 카페 객체에 거리 정보 추가
                    cafe.distance = distance / 1000  # km 단위
                    cafe.duration = duration
                    nearby_cafes.append(cafe)
                    
            except (AttributeError, ValueError, TypeError):
                continue
        
        # 거리순 정렬 후 제한
        nearby_cafes.sort(key=lambda x: x.distance)
        return nearby_cafes[:limit]


class MapJSGenerator:
    """JavaScript 지도 코드 생성 유틸리티"""
    
    @staticmethod
    def generate_marker_svg(color: str = '#ef4444', icon: str = '🎂') -> str:
        """지도 마커용 SVG 생성"""
        return f"""
            <svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'>
                <path d='M16 0C7.163 0 0 7.163 0 16s16 24 16 24 16-15.163 16-24S24.837 0 16 0z' fill='{color}'/>
                <circle cx='16' cy='16' r='8' fill='white'/>
                <text x='16' y='20' text-anchor='middle' font-family='Arial' font-size='12' font-weight='bold' fill='{color}'>{icon}</text>
            </svg>
        """
    
    @staticmethod
    def generate_user_location_marker_svg() -> str:
        """사용자 위치 마커용 SVG 생성"""
        return """
            <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
                <circle cx='12' cy='12' r='10' fill='#3b82f6' stroke='white' stroke-width='2'/>
                <circle cx='12' cy='12' r='4' fill='white'/>
            </svg>
        """


# 편의 함수들 (하위 호환성 및 간편 사용)
def validate_coordinates(latitude, longitude):
    """좌표 유효성 검사 - 편의 함수"""
    return MapDataGenerator.validate_coordinates(latitude, longitude)

def cafe_to_map_data(cafe):
    """카페를 지도 데이터로 변환 - 편의 함수"""
    return MapDataGenerator.cafe_to_map_data(cafe)

def cafes_to_map_json(cafes_queryset, ensure_ascii=False):
    """카페들을 JSON으로 변환 - 편의 함수"""
    return MapDataGenerator.cafes_to_map_json(cafes_queryset, ensure_ascii)

def get_map_context(cafes_queryset=None, **kwargs):
    """지도 템플릿 컨텍스트 - 편의 함수"""
    return MapConfigManager.get_context_for_template(cafes_queryset, **kwargs)

def calculate_distance(lat1, lng1, lat2, lng2):
    """거리 계산 - 편의 함수"""
    return DistanceCalculator.haversine_distance(lat1, lng1, lat2, lng2)

def get_nearby_cafes(user_lat, user_lng, cafes_queryset, radius_km=10, limit=10, exclude_id=None):
    """주변 카페 조회 - 편의 함수"""
    return DistanceCalculator.get_nearby_cafes(
        user_lat, user_lng, cafes_queryset, radius_km, limit, exclude_id
    )