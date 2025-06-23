# ddokchat/templatetags/price_filters.py - 최적화된 버전
from django import template
from django.utils.safestring import mark_safe

register = template.Library()

@register.simple_tag
def get_post_price_info(post, current_user=None, room=None):
    """
    모든 타입의 게시글 가격 정보를 반환하는 템플릿 태그
    캐시된 데이터 우선 사용, 분철의 경우 사용자 역할에 따라 다른 가격 표시
    """
    try:
        # ✅ 기본값 설정
        display_price = "가격 협의"
        min_price = 0
        max_price = 0
        has_range = False
        item_count = 0
        category_type = getattr(post, 'category_type', 'unknown')
        
        if category_type in ['sell', 'rental']:
            # ✅ 캐시된 ItemPrice 사용
            if hasattr(post, '_cached_item_prices') and post._cached_item_prices:
                # 캐시된 데이터 사용
                item_count = len(post._cached_item_prices)
                prices = [item.price for item in post._cached_item_prices if not item.is_price_undetermined]
                
                if prices:
                    min_price = min(prices)
                    max_price = max(prices)
                    has_range = min_price != max_price
                    
                    if has_range:
                        display_price = f"{min_price:,}원 ~ {max_price:,}원"
                    else:
                        display_price = f"{min_price:,}원"
                else:
                    display_price = "가격 미정"
                    
            else:
                # 캐시가 없으면 기존 price 속성 사용 (폴백)
                try:
                    price = getattr(post, 'price', 0)
                    if price > 0:
                        display_price = f"{price:,}원"
                        min_price = max_price = price
                except Exception as e:
                    print(f"기본 가격 정보 조회 오류: {e}")
                        
        elif category_type == 'split':
            # ✅ 분철: 사용자 역할에 따라 다른 가격 표시
            if current_user and room:
                # 채팅방 컨텍스트에서 사용자 역할 확인
                if current_user == getattr(post, 'user', None):
                    # 총대(판매자): 전체 가격 범위 표시
                    display_price, min_price, max_price, has_range, item_count = _get_split_seller_price(post)
                else:
                    # 참여자(구매자): 자신이 참여한 멤버들의 가격 합계
                    display_price, min_price, max_price, has_range, item_count = _get_split_participant_price(post, current_user)
            else:
                # 일반적인 경우: 전체 가격 범위 표시
                display_price, min_price, max_price, has_range, item_count = _get_split_seller_price(post)
        
        return {
            'display_price': display_price,
            'min_price': min_price,
            'max_price': max_price,
            'has_range': has_range,
            'item_count': item_count,
            'category_type': category_type
        }
        
    except Exception as e:
        # 오류 시 기본값 반환
        print(f"가격 정보 처리 오류: {e}")
        return {
            'display_price': '가격 협의',
            'min_price': 0,
            'max_price': 0,
            'has_range': False,
            'item_count': 0,
            'category_type': 'unknown'
        }

def _get_split_seller_price(post):
    """분철 총대(판매자)용 가격 정보 - 전체 범위"""
    try:
        # 캐시된 member_prices 사용
        if hasattr(post, '_cached_member_prices') and post._cached_member_prices:
            prices = [price.price for price in post._cached_member_prices]
            if prices:
                item_count = len(prices)
                min_price = min(prices)
                max_price = max(prices)
                has_range = min_price != max_price
                
                if has_range:
                    display_price = f"{min_price:,}원 ~ {max_price:,}원"
                else:
                    display_price = f"{min_price:,}원"
                
                return display_price, min_price, max_price, has_range, item_count
        
        # 캐시가 없으면 DB 조회 (폴백)
        try:
            if hasattr(post, 'member_prices'):
                prices_qs = post.member_prices.values_list('price', flat=True)
                prices = list(prices_qs)
                if prices:
                    item_count = len(prices)
                    min_price = min(prices)
                    max_price = max(prices)
                    has_range = min_price != max_price
                    
                    if has_range:
                        display_price = f"{min_price:,}원 ~ {max_price:,}원"
                    else:
                        display_price = f"{min_price:,}원"
                    
                    return display_price, min_price, max_price, has_range, item_count
        except Exception as e:
            print(f"분철 총대 가격 정보 DB 조회 오류: {e}")
        
        return "가격 협의", 0, 0, False, 0
        
    except Exception as e:
        print(f"분철 총대 가격 정보 처리 오류: {e}")
        return "가격 협의", 0, 0, False, 0

def _get_split_participant_price(post, current_user):
    """분철 참여자(구매자)용 가격 정보 - 참여한 멤버들의 가격 합계"""
    try:
        # ✅ 캐시된 applications 사용
        if hasattr(post, '_cached_applications'):
            applications = post._cached_applications
        else:
            # 캐시가 없으면 DB 조회
            from ddokfarm.models import SplitApplication
            applications = SplitApplication.objects.filter(
                post=post,
                user=current_user,
                status='approved'
            ).prefetch_related('members')
        
        # 해당 사용자의 승인된 신청 찾기
        user_application = None
        for app in applications:
            if app.user == current_user:
                user_application = app
                break
        
        if user_application:
            # 캐시된 member_prices 사용
            if hasattr(post, '_cached_member_prices'):
                member_prices = post._cached_member_prices
            else:
                member_prices = post.member_prices.all()
            
            # 신청한 멤버들의 ID 목록
            applied_member_ids = [member.id for member in user_application.members.all()]
            
            # 해당 멤버들의 가격 합계 계산
            total_price = sum(
                price.price for price in member_prices 
                if price.member_id in applied_member_ids
            )
            
            if total_price > 0:
                return f"{total_price:,}원", total_price, total_price, False, len(applied_member_ids)
        
        # 신청 정보가 없거나 가격이 0인 경우
        return "가격 협의", 0, 0, False, 0
        
    except Exception as e:
        print(f"분철 참여자 가격 정보 처리 오류: {e}")
        return "가격 협의", 0, 0, False, 0

@register.filter  
def get_split_post_price_info(post):
    """
    ✅ 분철 게시글 전용 가격 정보 필터 (총대 기준)
    템플릿에서 |get_split_post_price_info로 사용
    """
    try:
        if not post or getattr(post, 'category_type', '') != 'split':
            return {
                'display_price': '가격 협의',
                'has_range': False,
                'item_count': 0
            }
        
        display_price, min_price, max_price, has_range, item_count = _get_split_seller_price(post)
        
        return {
            'display_price': display_price,
            'has_range': has_range,
            'item_count': item_count
        }
        
    except Exception as e:
        print(f"분철 가격 정보 처리 오류: {e}")
        return {
            'display_price': '가격 협의',
            'has_range': False,
            'item_count': 0
        }

@register.simple_tag
def get_split_participant_members(post, user):
    """
    ✅ 분철 참여자가 신청한 멤버들의 이름 목록 반환
    """
    try:
        # 캐시된 applications 사용
        if hasattr(post, '_cached_applications'):
            applications = post._cached_applications
        else:
            # 캐시가 없으면 DB 조회
            from ddokfarm.models import SplitApplication
            applications = SplitApplication.objects.filter(
                post=post,
                user=user,
                status='approved'
            ).prefetch_related('members')
        
        # 해당 사용자의 승인된 신청 찾기
        for app in applications:
            if app.user == user:
                member_names = [member.member_name for member in app.members.all()]
                return ', '.join(member_names)  # "카리나, 닝닝"
        
        return "멤버 정보 없음"
        
    except Exception as e:
        print(f"분철 참여자 멤버 정보 처리 오류: {e}")
        return "멤버 정보 없음"

@register.simple_tag
def debug_price_cache(post):
    """
    ✅ 디버깅용: 캐시된 가격 정보 확인
    """
    debug_info = {
        'has_item_prices_cache': hasattr(post, '_cached_item_prices'),
        'has_member_prices_cache': hasattr(post, '_cached_member_prices'),
        'has_applications_cache': hasattr(post, '_cached_applications'),
        'category_type': getattr(post, 'category_type', 'unknown'),
        'post_id': getattr(post, 'id', 'unknown')
    }
    
    if hasattr(post, '_cached_item_prices'):
        debug_info['item_prices_count'] = len(post._cached_item_prices)
    
    if hasattr(post, '_cached_member_prices'):
        debug_info['member_prices_count'] = len(post._cached_member_prices)
    
    if hasattr(post, '_cached_applications'):
        debug_info['applications_count'] = len(post._cached_applications)
    
    return debug_info