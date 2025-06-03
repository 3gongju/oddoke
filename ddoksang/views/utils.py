# ddoksang/views/utils.py

from ddoksang.models import CafeFavorite
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q
from datetime import date
import json
from django.conf import settings

DEFAULT_PAGE_SIZE = getattr(settings, 'DEFAULT_PAGE_SIZE', 10)

def validate_coordinates(latitude, longitude):
    """위도/경도가 유효한지 검사"""
    try:
        lat = float(latitude)
        lon = float(longitude)
        return -90 <= lat <= 90 and -180 <= lon <= 180
    except (ValueError, TypeError):
        return False


def get_user_favorites(user):
    """현재 로그인한 유저의 찜한 카페 ID 목록"""
    if user.is_authenticated:
        return set(CafeFavorite.objects.filter(user=user).values_list("cafe_id", flat=True))
    return set()

def get_safe_cafe_map_data(cafe):
    """카페 지도 데이터를 안전하게 JSON으로 변환"""
    data = {
        "cafe_name": cafe.cafe_name,
        "location": cafe.location,
        "latitude": str(cafe.latitude),
        "longitude": str(cafe.longitude),
    }
    return json.dumps(data, cls=DjangoJSONEncoder)

def get_nearby_cafes(cafe):
    """같은 지역의 다른 카페들 반환 (동일 지역 + 다른 ID)"""
    if not cafe.location:
        return []

    return cafe.__class__.objects.filter(
        Q(location=cafe.location) & ~Q(id=cafe.id)
    ).select_related('artist', 'member')[:5]

