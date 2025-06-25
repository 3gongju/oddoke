from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from datetime import timedelta
from .models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment

admin.site.register(DamCommunityPost)
admin.site.register(DamMannerPost)
admin.site.register(DamBdaycafePost)
admin.site.register(DamComment) 

