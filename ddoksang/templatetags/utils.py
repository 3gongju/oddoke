from django import template

register = template.Library()

@register.filter
def split(value, delimiter=None):
    """
    문자열을 주어진 구분자로 나눕니다.
    기본 구분자는 쉼표(,)이며, # 등도 직접 지정 가능.
    """
    if delimiter is None:
        delimiter = ","  # 기본값은 쉼표
    return value.split(delimiter)
