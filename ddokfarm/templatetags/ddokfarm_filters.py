from django import template
from django.utils import timezone
from datetime import timedelta

register = template.Library()

@register.filter
def smart_date(value):
    """24시간 이내면 상대시간, 이후면 날짜만 표시"""
    if not value:
        return ""
    
    now = timezone.now()
    diff = now - value
    
    if diff < timedelta(hours=24):
        # 24시간 이내
        if diff < timedelta(minutes=1):
            return "방금 전"
        elif diff < timedelta(hours=1):
            return f"{int(diff.total_seconds() // 60)}분 전"
        else:
            return f"{int(diff.total_seconds() // 3600)}시간 전"
    else:
        # 24시간 이후
        return value.strftime("%m월 %d일")