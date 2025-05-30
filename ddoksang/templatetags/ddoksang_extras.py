from django import template

register = template.Library()

@register.filter
def split(value, delimiter):
    """문자열을 구분자로 분리"""
    if value:
        return value.split(delimiter)
    return []

@register.filter
def strip(value):
    """문자열 양쪽 공백 제거"""
    if value:
        return value.strip()
    return value