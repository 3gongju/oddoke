# ddokchat/templatetags/price_filters.py - 캐시된 데이터 활용
from django import template

register = template.Library()

@register.simple_tag
def get_post_price_info(post):
    """
    모든 타입의 게시글 가격 정보를 반환하는 템플릿 태그
    기존 모델 메서드들과 캐시된 ItemPrice 활용
    """
    try:
        # ✅ 모델에 이미 구현된 메서드 사용
        display_price = post.get_display_price()
        
        # 가격 범위가 있는지 확인
        if hasattr(post, 'get_price_range'):
            min_price, max_price = post.get_price_range()
            has_range = min_price != max_price
        else:
            # 기본 가격 사용
            price = getattr(post, 'price', 0)
            min_price = max_price = price
            has_range = False
        
        # 물건 개수 정보
        item_count = 0
        category_type = getattr(post, 'category_type', 'unknown')
        
        if category_type in ['sell', 'rental']:
            # ✅ 캐시된 ItemPrice 사용 (있으면)
            if hasattr(post, '_cached_item_prices'):
                item_count = len(post._cached_item_prices)
                # 캐시된 데이터로 가격 범위 재계산
                if item_count > 0:
                    prices = [item.price for item in post._cached_item_prices]
                    min_price = min(prices)
                    max_price = max(prices)
                    has_range = min_price != max_price
                    if has_range:
                        display_price = f"{min_price:,}원 ~ {max_price:,}원"
                    else:
                        display_price = f"{min_price:,}원"
            # 캐시가 없으면 기존 방식 사용 (DB 쿼리 발생할 수 있음)
            elif hasattr(post, 'has_multiple_items') and post.has_multiple_items():
                if hasattr(post, 'get_item_prices'):
                    item_count = post.get_item_prices().count()
                    
        elif category_type == 'split':
            # 분철의 경우 캐시된 member_prices 또는 DB 조회
            if hasattr(post, '_cached_member_prices'):
                # 캐시된 데이터 사용
                item_count = len(post._cached_member_prices)
                if item_count > 0:
                    prices = [price.price for price in post._cached_member_prices]
                    min_price = min(prices)
                    max_price = max(prices)
                    has_range = min_price != max_price
                    if has_range:
                        display_price = f"{min_price:,}원 ~ {max_price:,}원"
                    else:
                        display_price = f"{min_price:,}원"
            elif hasattr(post, 'member_prices'):
                # DB 조회 (캐시가 없을 때만)
                try:
                    item_count = post.member_prices.count()
                    if item_count > 0:
                        prices = list(post.member_prices.values_list('price', flat=True))
                        min_price = min(prices)
                        max_price = max(prices)
                        has_range = min_price != max_price
                        if has_range:
                            display_price = f"{min_price:,}원 ~ {max_price:,}원"
                        else:
                            display_price = f"{min_price:,}원"
                except Exception:
                    item_count = 0
        
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
        print(f"가격 정보 처리 오류: {e}")  # 디버깅용
        return {
            'display_price': '가격 협의',
            'min_price': 0,
            'max_price': 0,
            'has_range': False,
            'item_count': 0,
            'category_type': 'unknown'
        }