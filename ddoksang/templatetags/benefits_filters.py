from django import template

register = template.Library()

@register.filter
def parse_benefits(special_benefits):
    """
    특전 정보를 카테고리별로 분류하여 반환
    create_success.html과 동일한 방식으로 파싱
    """
    if not special_benefits:
        return {}
    
    categories = {
        '일반': [],
        '선착': [],
        '기타': []
    }
    
    # 쉼표로 분할하여 각 특전 처리
    benefits_list = [benefit.strip() for benefit in special_benefits.split(',') if benefit.strip()]
    
    for benefit in benefits_list:
        if ':' in benefit:
            # "카테고리:내용" 형태
            category, item = benefit.split(':', 1)
            category = category.strip()
            item = item.strip()
            
            if category in categories:
                categories[category].append(item)
            else:
                # 알 수 없는 카테고리는 기타로 분류
                categories['기타'].append(item)
        else:
            # 카테고리가 없는 경우 일반으로 분류
            categories['일반'].append(benefit)
    
    # 빈 카테고리 제거 (내용이 있는 것만 반환)
    return {k: v for k, v in categories.items() if v}

@register.filter  
def get_category_color(category):
    """카테고리별 Tailwind CSS 클래스 반환"""
    colors = {
        '일반': 'bg-blue-100 text-blue-800',
        '선착': 'bg-red-100 text-red-800', 
        '기타': 'bg-green-100 text-green-800'
    }
    return colors.get(category, 'bg-gray-100 text-gray-800')

@register.filter
def get_category_icon(category):
    """카테고리별 아이콘 반환"""
    icons = {
        '일반': '',
        '선착': '',
        '기타': ''
    }
    return icons.get(category, '🎈')