# ddoksang/utils/map_utils.py
# 지도 관련 유틸리티 함수들 통합

import math
import json
import logging
from datetime import date
from typing import List, Dict, Any, Optional, Union
from django.db import models
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder

logger = logging.getLogger(__name__)

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 지점 간의 거리를 계산 (하버사인 공식, 미터 단위)"""
    R = 6371000  # 지구 반지름 (미터)
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(delta_lng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def is_valid_coordinates(lat: Union[str, float, None], lng: Union[str, float, None]) -> bool:
    """좌표 유효성 검사"""
    try:
        lat_f = float(lat) if lat is not None else None
        lng_f = float(lng) if lng is not None else None
        
        if lat_f is None or lng_f is None:
            return False
            
        return (-90 <= lat_f <= 90) and (-180 <= lng_f <= 180)
    except (ValueError, TypeError):
        return False


def get_nearby_cafes(
    user_lat: float, 
    user_lng: float, 
    cafes_queryset, 
    radius_km: float = 5.0, 
    limit: int = 20,
    exclude_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """주변 카페 검색"""
    
    nearby_cafes = []
    
    for cafe in cafes_queryset:
        # 제외할 카페 ID가 있는 경우 건너뛰기
        if exclude_id and cafe.id == exclude_id:
            continue
            
        # 좌표 유효성 검사
        if not is_valid_coordinates(cafe.latitude, cafe.longitude):
            continue
            
        try:
            cafe_lat = float(cafe.latitude)
            cafe_lng = float(cafe.longitude)
            
            # 거리 계산
            distance_m = calculate_distance(user_lat, user_lng, cafe_lat, cafe_lng)
            distance_km = distance_m / 1000
            
            # 반경 내에 있는 카페만 포함
            if distance_km <= radius_km:
                cafe_data = {
                    'id': cafe.id,
                    'cafe_name': cafe.cafe_name,
                    'artist': cafe.artist.display_name if cafe.artist else '',
                    'member': cafe.member.member_name if cafe.member else '',
                    'address': cafe.address,
                    'latitude': cafe_lat,
                    'longitude': cafe_lng,
                    'distance': round(distance_km, 2),
                    'distance_m': round(distance_m),
                    'walk_time': round(distance_m / 80),  # 평균 도보 속도 80m/분
                    'main_image': cafe.get_main_image() if hasattr(cafe, 'get_main_image') else None,
                    'is_active': cafe.is_active if hasattr(cafe, 'is_active') else False,
                    'days_remaining': cafe.days_remaining if hasattr(cafe, 'days_remaining') else 0,
                    'days_until_start': cafe.days_until_start if hasattr(cafe, 'days_until_start') else 0,
                    'start_date': cafe.start_date.isoformat() if cafe.start_date else None,
                    'end_date': cafe.end_date.isoformat() if cafe.end_date else None,
                }
                
                # 같은 아티스트/멤버인지 확인 (관련 카페 표시용)
                # cafe_data['is_related'] = (
                #     cafe.artist == original_cafe.artist or 
                #     (cafe.member and original_cafe.member and cafe.member == original_cafe.member)
                # ) if original_cafe else False
                
                nearby_cafes.append(cafe_data)
                
        except (ValueError, TypeError, AttributeError) as e:
            logger.warning(f"카페 {cafe.id} 주변 검색 처리 오류: {e}")
            continue
    
    # 거리순으로 정렬 후 제한
    nearby_cafes.sort(key=lambda x: x['distance'])
    return nearby_cafes[:limit]


def serialize_cafe_for_map(cafe) -> Dict[str, Any]:
    """카페 객체를 지도용 JSON으로 직렬화"""
    try:
        return {
            'id': cafe.id,
            'cafe_name': cafe.cafe_name,
            'name': cafe.cafe_name,  # 하위 호환성
            'latitude': float(cafe.latitude),
            'longitude': float(cafe.longitude),
            'address': cafe.address,
            'road_address': cafe.road_address or '',
            
            # 아티스트/멤버 정보
            'artist_name': cafe.artist.display_name if cafe.artist else '',
            'artist': {
                'display_name': cafe.artist.display_name if cafe.artist else '',
                'id': cafe.artist.id if cafe.artist else None
            },
            'member_name': cafe.member.member_name if cafe.member else '',
            'member': {
                'member_name': cafe.member.member_name if cafe.member else '',
                'id': cafe.member.id if cafe.member else None
            } if cafe.member else None,
            
            # 운영 정보
            'start_date': cafe.start_date.isoformat(),
            'end_date': cafe.end_date.isoformat(),
            'status': cafe.status,
            'is_active': cafe.is_active,
            
            # 이미지 정보
            'main_image': cafe.get_main_image() if hasattr(cafe, 'get_main_image') else None,
            'main_image_url': cafe.get_main_image() if hasattr(cafe, 'get_main_image') else None,
            'image_url': cafe.get_main_image() if hasattr(cafe, 'get_main_image') else None,  # 하위 호환성
            
            # 추가 정보
            'cafe_type': cafe.cafe_type,
            'special_benefits': cafe.special_benefits or '',
            'event_description': cafe.event_description or '',
            'view_count': cafe.view_count,
            'created_at': cafe.created_at.isoformat(),
        }
    except Exception as e:
        logger.error(f"카페 {cafe.id} 직렬화 오류: {e}")
        return None


def get_map_context(cafes_queryset=None) -> Dict[str, Any]:
    """지도 관련 컨텍스트 생성"""
    
    # 기본 지도 설정 (원래대로)
    context = {
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        'default_center': {'lat': 37.5665, 'lng': 126.9780},  # 서울 시청
        'default_zoom': 8,
    }
    
    # 카페 데이터가 제공된 경우
    if cafes_queryset is not None:
        cafes_json_data = []
        valid_cafes_count = 0
        
        for cafe in cafes_queryset:
            # 좌표 유효성 검사
            if not is_valid_coordinates(cafe.latitude, cafe.longitude):
                logger.warning(f"카페 {cafe.id}: 잘못된 좌표 ({cafe.latitude}, {cafe.longitude})")
                continue
                
            cafe_data = serialize_cafe_for_map(cafe)
            if cafe_data:
                cafes_json_data.append(cafe_data)
                valid_cafes_count += 1
        
        # JSON 직렬화
        try:
            cafes_json = json.dumps(cafes_json_data, cls=DjangoJSONEncoder, ensure_ascii=False)
        except Exception as e:
            logger.error(f"카페 데이터 JSON 직렬화 오류: {e}")
            cafes_json = '[]'
        
        context.update({
            'cafes_json': cafes_json,
            'total_cafes': valid_cafes_count,
            'cafes_data': cafes_json_data,  # 템플릿에서 직접 사용 가능
        })
        
        logger.info(f"지도 컨텍스트 생성 완료: {valid_cafes_count}개 카페")
    
    return context


def filter_operating_cafes(cafes_queryset, reference_date: Optional[date] = None):
    """현재 운영중인 카페만 필터링"""
    if reference_date is None:
        reference_date = date.today()
    
    return cafes_queryset.filter(
        start_date__lte=reference_date,
        end_date__gte=reference_date
    )


def get_cafe_status(cafe, reference_date: Optional[date] = None) -> str:
    """카페 운영 상태 반환 ('upcoming', 'ongoing', 'ended')"""
    if reference_date is None:
        reference_date = date.today()
    
    if cafe.start_date > reference_date:
        return 'upcoming'
    elif cafe.end_date >= reference_date:
        return 'ongoing'
    else:
        return 'ended'


# 하위 호환성을 위한 별칭
def haversine_distance(lat1, lng1, lat2, lng2):
    """하위 호환성을 위한 별칭"""
    return calculate_distance(lat1, lng1, lat2, lng2)


def find_nearby_cafes(*args, **kwargs):
    """하위 호환성을 위한 별칭"""
    return get_nearby_cafes(*args, **kwargs)