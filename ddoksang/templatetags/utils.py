from django import template

register = template.Library()

@register.filter
def split(value, delimiter="#"):
    """문자열을 특정 구분자로 나눕니다"""
    return value.split(delimiter)
