from django import template
from datetime import date


register = template.Library()

# 템플릿 필터: 공백 제거
@register.filter
def strip(value):
    if value:
        return value.strip()
    return value

# 템플릿 필터: 문자열 분리
@register.filter
def split(value, delimiter=None):
    if delimiter is None:
        delimiter = ","
    return value.split(delimiter)

# 템플릿 필터: 카페 상태
@register.filter
def cafe_status(cafe):
    """카페의 진행 상태 (upcoming / ongoing / ended)"""
    today = date.today()
    if cafe.start_date and cafe.start_date > today:
        return 'upcoming'
    elif cafe.end_date and cafe.end_date < today:
        return 'ended'
    return 'ongoing'
