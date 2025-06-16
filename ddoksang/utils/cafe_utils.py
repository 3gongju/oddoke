# ddoksang/utils/cafe_utils.py
# 카페 관련 공통 유틸리티 함수들

import logging
from .map_utils import get_nearby_cafes, get_map_context
from .favorite_utils import get_user_favorites

logger = logging.getLogger(__name__)

def get_member_nearby_cafes(cafe, exclude_cafe_id=None):
    """
    같은 멤버의 다른 카페들을 거리순으로 반환
    cafe: 기준이 되는 카페 객체
    exclude_cafe_id: 제외할 카페 ID (보통 현재 카페)
    """
    nearby_member_cafes = []
    
    if cafe.latitude and cafe.longitude and cafe.member:
        try:
            from ..models import BdayCafe
            
            # 같은 멤버의 승인된 카페들
            member_cafes = BdayCafe.objects.filter(
                member=cafe.member,
                status='approved'
            ).select_related('artist', 'member')
            
            # 현재 카페 제외
            if exclude_cafe_id:
                member_cafes = member_cafes.exclude(id=exclude_cafe_id)
            
            # 거리순으로 정렬
            nearby_member_cafes = get_nearby_cafes(
                user_lat=float(cafe.latitude), 
                user_lng=float(cafe.longitude), 
                cafes_queryset=member_cafes,
                radius_km=50,
                limit=10,
                exclude_id=exclude_cafe_id
            )
            
            logger.info(f"{cafe.member.member_name}의 다른 카페 {len(nearby_member_cafes)}개 발견")
            
        except (ValueError, TypeError) as e:
            logger.warning(f"멤버 카페 조회 오류: {e}")
    
    return nearby_member_cafes


def get_cafe_detail_context(cafe, user, is_preview=False, can_edit=False, preview_type=None):
    """
    카페 상세 페이지용 공통 컨텍스트 생성
    - 중복되는 뷰 로직을 통합
    """
    # 사용자 찜 상태 확인
    is_favorited = False
    if user.is_authenticated:
        from ..models import CafeFavorite
        is_favorited = CafeFavorite.objects.filter(
            user=user, 
            cafe=cafe
        ).exists()
    
    # 같은 멤버의 다른 카페들
    nearby_member_cafes = get_member_nearby_cafes(cafe, exclude_cafe_id=cafe.id)
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(user)
    
    # 지도 관련 컨텍스트
    map_context = get_map_context()
    
    return {
        'cafe': cafe,
        'is_favorited': is_favorited,
        'nearby_member_cafes': nearby_member_cafes,
        'user_favorites': user_favorites,
        'is_preview': is_preview,
        'can_edit': can_edit,
        'preview_type': preview_type,
        **map_context,
    }

