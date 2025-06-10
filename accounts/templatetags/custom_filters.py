from django import template
register = template.Library()

@register.filter
def get_item(dictionary, key):
    return dictionary.get(key)

@register.filter
def multiply(value, arg):
    try:
        return float(value) * float(arg)
    except (ValueError, TypeError):
        return 0


@register.filter
def divide(value, divisor):
    try:
        return float(value) / float(divisor)
    except (ValueError, ZeroDivisionError):
        return 0


@register.filter
def floatval(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0

@register.filter
def percentage(value, total):
    try:
        return int((value / total) * 100)
    except (ValueError, ZeroDivisionError):
        return 0


@register.filter
def bar_shade_by_count(value):
    try:
        count = int(value)
    except (ValueError, TypeError):
        return "#D1D5DB"  # 변환 실패 시 연함 처리

    if count >= 5:
        return "#111827"  # 진함
    elif count >= 3:
        return "#4B5563"  # 중간
    else:
        return "#D1D5DB"  # 연함