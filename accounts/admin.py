from django.contrib import admin
from .models import User 
# Register your models here.
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'is_verified_fandom', 'is_pending_verification', 'fandom_artist')
    list_filter = ('is_verified_fandom', 'is_pending_verification')