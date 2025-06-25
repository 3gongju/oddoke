# accounts/point_utils.py
from django.db import transaction
from .models import DdokPoint, DdokPointLog
from artist.models import Member

def add_ddok_points(user, points, reason='BIRTHDAY_GAME', related_member=None):
    """
    사용자에게 덕 포인트 추가/차감
    
    Args:
        user: User 객체
        points: 추가할 포인트 (int) - 음수면 차감
        reason: 포인트 변동 사유
        related_member: 관련 멤버 (Member 객체, 선택)
    
    Returns:
        tuple: (DdokPoint 객체, DdokPointLog 객체)
    """
    with transaction.atomic():
        # 사용자 포인트 계정 가져오거나 생성
        ddok_point = user.get_or_create_ddok_point()
        
        # 포인트 변동 (음수도 지원)
        ddok_point.total_points += points
        
        # 포인트가 음수가 되지 않도록 방지
        if ddok_point.total_points < 0:
            ddok_point.total_points = 0
            
        ddok_point.save()
        
        # 포인트 로그 기록
        point_log = DdokPointLog.objects.create(
            point_owner=ddok_point,
            points_change=points,
            reason=reason,
            related_member=related_member
        )
        
        return ddok_point, point_log

def get_user_ddok_points(user):
    """사용자의 총 덕 포인트 조회"""
    try:
        ddok_point = user.ddok_point
        return ddok_point.total_points
    except DdokPoint.DoesNotExist:
        return 0

def get_user_point_history(user, limit=10):
    """사용자의 포인트 내역 조회"""
    try:
        ddok_point = user.ddok_point
        return ddok_point.logs.select_related('related_member', 'related_member__artist')[:limit]
    except DdokPoint.DoesNotExist:
        return []