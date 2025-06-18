from django.conf import settings 
# 10개 제한 적용

import logging
from .map_utils import get_nearby_cafes, get_map_context
from .favorite_utils import get_user_favorites

logger = logging.getLogger(__name__)

def get_member_nearby_cafes(cafe, exclude_cafe_id=None, filter_type='active_and_upcoming', limit=10):
    """
    ✅ 수정: 같은 멤버의 다른 카페들만 거리순으로 반환 (제한된 개수)
    cafe: 기준이 되는 카페 객체
    exclude_cafe_id: 제외할 카페 ID (보통 현재 카페)
    filter_type: 'all', 'active_only', 'active_and_upcoming'
    limit: 반환할 최대 카페 개수 (기본: 10개)
    """
    nearby_member_cafes = []
    
    logger.info(f"=== get_member_nearby_cafes 시작 ===")
    logger.info(f"현재 카페: {cafe.cafe_name} (ID: {cafe.id})")
    logger.info(f"멤버: {cafe.member.member_name if cafe.member else 'None'}")
    logger.info(f"제한 개수: {limit}개")
    
    if not cafe.latitude or not cafe.longitude:
        logger.warning(f"❌ 카페 좌표가 없음: ({cafe.latitude}, {cafe.longitude})")
        return []
    
    # ✅ 멤버가 없으면 빈 리스트 반환 (관련 카페 없음)
    if not cafe.member:
        logger.warning(f"❌ 카페에 멤버가 연결되지 않음 - 관련 카페 없음")
        return []
    
    try:
        from ..models import BdayCafe
        from datetime import date
        
        # ✅ 수정: 같은 멤버의 승인된 카페들만 (아티스트 조건 제거)
        member_cafes = BdayCafe.objects.filter(
            member=cafe.member,  # 같은 멤버만
            status='approved'
        ).select_related('artist', 'member')
        
        logger.info(f"✅ 같은 멤버({cafe.member.member_name})의 카페만 필터링")
        
        # 운영 상태 필터링
        today = date.today()
        
        if filter_type == 'active_only':
            member_cafes = member_cafes.filter(
                start_date__lte=today,
                end_date__gte=today
            )
        elif filter_type == 'active_and_upcoming':
            member_cafes = member_cafes.filter(
                end_date__gte=today
            )
        
        # 현재 카페 제외
        if exclude_cafe_id:
            member_cafes = member_cafes.exclude(id=exclude_cafe_id)
        
        logger.info(f"필터링 후 카페 개수: {member_cafes.count()}개")
        
        # 좌표가 있는 카페만 필터링
        cafes_with_coords = member_cafes.filter(
            latitude__isnull=False,
            longitude__isnull=False
        )
        
        logger.info(f"좌표가 있는 카페: {cafes_with_coords.count()}개")
        
        if not cafes_with_coords.exists():
            logger.warning(f"⚠️ 좌표가 있는 다른 멤버 카페가 없음")
            return []
        
        # 거리 계산 및 정렬 (제한된 개수만)
        try:
            nearby_member_cafes = get_nearby_cafes(
                user_lat=float(cafe.latitude), 
                user_lng=float(cafe.longitude), 
                cafes_queryset=cafes_with_coords,
                radius_km=200,  # 더 넓은 반경으로 검색
                limit=limit,    # 제한된 개수만 반환
                exclude_id=exclude_cafe_id
            )
            
            logger.info(f"✅ {cafe.member.member_name}의 근처 카페 {len(nearby_member_cafes)}개 반환 (최대 {limit}개 제한)")
            
        except Exception as e:
            logger.error(f"❌ get_nearby_cafes 오류: {e}")
            return []
        
    except Exception as e:
        logger.error(f"❌ 멤버 카페 조회 오류: {e}", exc_info=True)
        return []
    
    return nearby_member_cafes


def get_cafe_detail_context(cafe, user, is_preview=False, can_edit=False, preview_type=None):
    """
    카페 상세 페이지용 공통 컨텍스트 생성
    - 최대 10개의 근처 카페만 표시 (같은 멤버만)
    """
    logger.info(f"=== get_cafe_detail_context 시작 ===")
    logger.info(f"카페: {cafe.cafe_name} (ID: {cafe.id})")
    logger.info(f"멤버: {cafe.member.member_name if cafe.member else 'None'}")
    
    # 사용자 찜 상태 확인
    is_favorited = False
    if user.is_authenticated:
        from ..models import CafeFavorite
        is_favorited = CafeFavorite.objects.filter(
            user=user, 
            cafe=cafe
        ).exists()
    
    # ✅ 근처 카페: 같은 멤버의 카페만 최대 10개
    nearby_cafes = get_member_nearby_cafes(
        cafe, 
        exclude_cafe_id=cafe.id,
        filter_type='active_and_upcoming',
        limit=10  # 최대 10개로 제한
    )
    
    logger.info(f"컨텍스트에 전달될 nearby_cafes: {len(nearby_cafes)}개 (같은 멤버만, 최대 10개)")
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(user)
    
    # 지도 관련 컨텍스트
    map_context = get_map_context()
    
    context = {
        'cafe': cafe,
        'is_favorited': is_favorited,
        'nearby_cafes': nearby_cafes,
        'user_favorites': user_favorites,
        'is_preview': is_preview,
        'can_edit': can_edit,
        'preview_type': preview_type,
        **map_context,
    }
    
    logger.info(f"=== get_cafe_detail_context 완료 ===")
    return context