from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

# Register your models here.
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'username', 'email', 'is_verified_fandom',
        'is_pending_verification', 'verification_failed'
    )
    list_filter = ('is_verified_fandom', 'is_pending_verification', 'verification_failed')
    search_fields = ('username', 'email')
    ordering = ('-date_joined',)
    actions = ['approve_fandom', 'reject_fandom']

    @admin.action(description="✅ 공식 팬덤 인증 승인")
    def approve_fandom(self, request, queryset):
        updated = queryset.update(
            is_verified_fandom=True,
            is_pending_verification=False,
            verification_failed=False
        )
        self.message_user(request, f"{updated}명의 유저가 공식 팬덤으로 인증되었습니다.")

    @admin.action(description="❌ 공식 팬덤 인증 거절")
    def reject_fandom(self, request, queryset):
        updated = queryset.update(
            is_verified_fandom=False,
            is_pending_verification=False,
            verification_failed=True
        )
        self.message_user(request, f"{updated}명의 유저가 인증에서 제외되었습니다.")
