# ddokchat/templatetags/price_filters.py
from django import template
from django.db import models
from ddokfarm.models import SplitApplication

register = template.Library()

@register.simple_tag
def get_smart_post_price(post, current_user=None, room=None):
    """
    스마트한 게시글 가격 표시:
    - 기본: get_price_base() 메서드 사용
    - 분철 참여자: 개별 참여 가격 계산
    """
    try:
        # 1. 기본적으로 모델의 get_price_base() 사용
        base_price = post.get_price_base() if hasattr(post, 'get_price_base') else "가격 협의"
        
        # 2. 분철이고 참여자인 경우만 개별 계산
        if (hasattr(post, 'category_type') and 
            post.category_type == 'split' and 
            current_user and 
            current_user != post.user):  # 총대가 아닌 참여자
            
            participant_price = _calculate_participant_price(post, current_user)
            if participant_price > 0:
                return f"{participant_price:,}원"
        
        return base_price
        
    except Exception as e:
        print(f"가격 조회 오류: {e}")
        return "가격 협의"

def _calculate_participant_price(post, user):
    """분철 참여자의 실제 참여 가격 계산"""
    try:
        # 승인된 신청 조회
        application = SplitApplication.objects.filter(
            post=post,
            user=user,
            status='approved'
        ).prefetch_related('members').first()
        
        if not application:
            return 0
        
        # 참여한 멤버들의 가격 합계
        applied_member_ids = list(application.members.values_list('id', flat=True))
        
        total_price = post.member_prices.filter(
            member_id__in=applied_member_ids
        ).aggregate(
            total=models.Sum('price')
        )['total'] or 0
        
        return total_price
        
    except Exception as e:
        print(f"분철 참여자 가격 계산 오류: {e}")
        return 0

@register.simple_tag
def get_participant_member_names(post, user):
    """분철 참여자가 신청한 멤버명들 반환"""
    try:
        application = SplitApplication.objects.filter(
            post=post,
            user=user,
            status='approved'
        ).prefetch_related('members').first()
        
        if application:
            member_names = [member.member_name for member in application.members.all()]
            return ', '.join(member_names)
        
        return "멤버 정보 없음"
        
    except Exception as e:
        print(f"멤버 정보 조회 오류: {e}")
        return "멤버 정보 없음"