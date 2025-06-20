# ddokchat/templatetags/price_filters.py - 수정된 버전
from django import template
from django.utils.safestring import mark_safe

register = template.Library()

@register.simple_tag
def get_post_price_info(post):
    """
    모든 타입의 게시글 가격 정보를 반환하는 템플릿 태그
    기존 모델 메서드들과 캐시된 ItemPrice 활용
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
            # ✅ 캐시된 ItemPrice 사용 (속성명 통일)
            if hasattr(post, '_cached_item_prices') and post._cached_item_prices:
                # 캐시된 데이터 사용
                item_count = len(post._cached_item_prices)
                prices = [item.price for item in post._cached_item_prices]
                min_price = min(prices)
                max_price = max(prices)
                has_range = min_price != max_price
                
                if has_range:
                    display_price = f"{min_price:,}원 ~ {max_price:,}원"
                else:
                    display_price = f"{min_price:,}원"
                    
            else:
                # 캐시가 없으면 기존 모델 메서드 사용
                try:
                    if hasattr(post, 'get_display_price'):
                        display_price = post.get_display_price()
                    else:
                        # 기본 가격 속성 사용
                        price = getattr(post, 'price', 0)
                        if price > 0:
                            display_price = f"{price:,}원"
                            min_price = max_price = price
                        
                    # 개별 아이템 개수 확인
                    if hasattr(post, 'has_multiple_items') and post.has_multiple_items():
                        if hasattr(post, 'get_item_prices'):
                            item_count = post.get_item_prices().count()
                        if hasattr(post, 'get_price_range'):
                            min_price, max_price = post.get_price_range()
                            has_range = min_price != max_price
                            
                except Exception as e:
                    print(f"기본 가격 정보 조회 오류: {e}")
                    # 최후의 수단: price 속성 직접 사용
                    price = getattr(post, 'price', 0)
                    if price > 0:
                        display_price = f"{price:,}원"
                        min_price = max_price = price
                        
        elif category_type == 'split':
            # 분철의 경우 캐시된 member_prices 사용
            if hasattr(post, '_cached_member_prices') and post._cached_member_prices:
                # 캐시된 데이터 사용
                item_count = len(post._cached_member_prices)
                prices = [price.price for price in post._cached_member_prices]
                min_price = min(prices)
                max_price = max(prices)
                has_range = min_price != max_price
                
                if has_range:
                    display_price = f"{min_price:,}원 ~ {max_price:,}원"
                else:
                    display_price = f"{min_price:,}원"
                    
            else:
                # 캐시가 없으면 기존 모델 메서드 사용
                try:
                    if hasattr(post, 'get_display_price'):
                        display_price = post.get_display_price()
                    elif hasattr(post, 'member_prices'):
                        # DB 조회 (캐시가 없을 때만)
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
                                
                except Exception as e:
                    print(f"분철 가격 정보 조회 오류: {e}")
                    # 기본 price 속성이 있다면 사용
                    price = getattr(post, 'price', 0)
                    if price > 0:
                        display_price = f"{price:,}원"
                        min_price = max_price = price
        
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

@register.filter  
def get_split_post_price_info(post):
    """
    ✅ 새로 추가: 분철 게시글 전용 가격 정보 필터
    템플릿에서 |get_split_post_price_info로 사용
    """
    try:
        if not post or getattr(post, 'category_type', '') != 'split':
            return {
                'display_price': '가격 협의',
                'has_range': False,
                'item_count': 0
            }
        
        # 캐시된 데이터 우선 사용
        if hasattr(post, '_cached_member_prices') and post._cached_member_prices:
            prices = [price.price for price in post._cached_member_prices]
            if prices:
                min_price = min(prices)
                max_price = max(prices)
                has_range = min_price != max_price
                
                if has_range:
                    display_price = f"{min_price:,}원 ~ {max_price:,}원"
                else:
                    display_price = f"{min_price:,}원"
                
                return {
                    'display_price': display_price,
                    'has_range': has_range,
                    'item_count': len(prices)
                }
        
        # 캐시가 없으면 모델 메서드 사용
        if hasattr(post, 'get_display_price'):
            return {
                'display_price': post.get_display_price(),
                'has_range': hasattr(post, 'get_price_range') and post.get_price_range()[0] != post.get_price_range()[1],
                'item_count': post.member_prices.count() if hasattr(post, 'member_prices') else 0
            }
        
        # 최후 수단
        return {
            'display_price': '가격 협의',
            'has_range': False,
            'item_count': 0
        }
        
    except Exception as e:
        print(f"분철 가격 정보 처리 오류: {e}")
        return {
            'display_price': '가격 협의',
            'has_range': False,
            'item_count': 0
        }