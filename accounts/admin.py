from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User
from django.utils.html import format_html

# Register your models here.
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'username', 'email', 'is_verified_fandom',
        'is_pending_verification', 'verification_failed',
        'fandom_preview'
    )
    list_filter = (
        'is_verified_fandom', 'is_pending_verification',
        'verification_failed', 'fandom_artist'
    )
    search_fields = ('username', 'email')
    ordering = ('-date_joined',)
    readonly_fields = ['fandom_card_preview']  # ✅ 보기 전용 필드 설정

    fieldsets = BaseUserAdmin.fieldsets + (
        ('팬덤 인증 정보', {
            'fields': (
                'fandom_card',
                'fandom_card_preview',
                'fandom_artist',
                'is_verified_fandom',
                'is_pending_verification',
                'verification_failed',
            ),
        }),
    )

    def fandom_preview(self, obj):
        if obj.fandom_card:
            return format_html('<img src="{}" width="50" />', obj.fandom_card.url)
        return '없음'
    fandom_preview.short_description = '팬덤 카드 썸네일'

    def fandom_card_preview(self, obj):
        if obj.fandom_card:
            return format_html('<img src="{}" width="250" />', obj.fandom_card.url)
        return '업로드된 카드 없음'

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
