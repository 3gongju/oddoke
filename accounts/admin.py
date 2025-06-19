# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, MannerReview, FandomProfile, BankProfile, AddressProfile
from django.utils.html import format_html
from django.utils import timezone
from datetime import timedelta

# Register your models here.
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'username', 'email', 'is_active', 'date_joined',
        'is_temp_username', 'social_signup_completed', 'suspension_status_display'
    )
    
    list_filter = (
        'is_active', 'is_staff', 'is_superuser', 
        'is_temp_username', 'social_signup_completed', 'date_joined',
        'suspension_start', 'suspension_end'
    )
    
    search_fields = ('username', 'email', 'first_name', 'last_name')
    
    ordering = ('-date_joined',)

    fieldsets = BaseUserAdmin.fieldsets + (
        ('소셜 로그인 정보', {
            'fields': (
                'is_temp_username',
                'social_signup_completed', 
                'is_profile_completed',
                'kakao_id',
                'naver_id',
            ),
        }),
        ('프로필 정보', {
            'fields': (
                'profile_image',
                'bio',
            ),
        }),
        ('제재 정보', {
            'fields': (
                'suspension_start',
                'suspension_end', 
                'suspension_reason',
            ),
        }),
    )
    
    def suspension_status_display(self, obj):
        """제재 상태 표시"""
        try:
            if obj.is_suspended:
                if obj.suspension_end:
                    return format_html(
                        '<span style="color: red; font-weight: bold;">제재중 ({})</span>',
                        obj.suspension_status
                    )
                else:
                    return format_html('<span style="color: red; font-weight: bold;">영구정지</span>')
            return format_html('<span style="color: green;">정상</span>')
        except Exception as e:
            # 오류 발생 시 기본값 반환
            return format_html('<span style="color: gray;">확인 불가</span>')
    suspension_status_display.short_description = '제재 상태'

    @admin.action(description="🔓 제재 해제")
    def lift_suspension(self, request, queryset):
        """선택된 사용자들의 제재 해제"""
        count = 0
        for user in queryset:
            if user.is_suspended:
                user.lift_suspension()
                count += 1
        
        self.message_user(request, f"{count}명의 사용자 제재를 해제했습니다.")

    @admin.action(description="🟡 3일 제재")
    def suspend_3_days(self, request, queryset):
        """선택된 사용자들을 3일 제재"""
        count = 0
        for user in queryset:
            if not user.is_suspended:
                user.suspend_user("관리자 수동 제재", days=3)
                count += 1
        
        self.message_user(request, f"{count}명의 사용자를 3일 제재했습니다.")

    @admin.action(description="🟠 14일 제재")
    def suspend_14_days(self, request, queryset):
        """선택된 사용자들을 14일 제재"""
        count = 0
        for user in queryset:
            if not user.is_suspended:
                user.suspend_user("관리자 수동 제재", days=14)
                count += 1
        
        self.message_user(request, f"{count}명의 사용자를 14일 제재했습니다.")

    @admin.action(description="🔴 영구정지")
    def permanent_ban(self, request, queryset):
        """선택된 사용자들을 영구정지"""
        count = 0
        for user in queryset:
            if not user.is_suspended:
                user.suspend_user("관리자 수동 영구정지")
                user.is_active = False
                user.save(update_fields=['is_active'])
                count += 1
        
        self.message_user(request, f"{count}명의 사용자를 영구정지했습니다.")

    actions = [
        'lift_suspension', 'suspend_3_days', 
        'suspend_14_days', 'permanent_ban'
    ]

@admin.register(FandomProfile)
class FandomProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'fandom_artist', 'is_verified_fandom', 
        'is_pending_verification', 'verification_failed',
        'verification_start_date', 'verification_end_date'
    )
    
    list_filter = (
        'is_verified_fandom', 'is_pending_verification', 
        'verification_failed', 'fandom_artist'
    )
    
    search_fields = ('user__username', 'user__email', 'fandom_artist__name')
    
    readonly_fields = ['fandom_card_preview', 'applied_at', 'verified_at', 'created_at', 'updated_at']
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('user', 'fandom_artist')
        }),
        ('인증 이미지', {
            'fields': ('fandom_card', 'fandom_card_preview')
        }),
        ('인증 상태', {
            'fields': (
                'is_verified_fandom', 'is_pending_verification', 
                'verification_failed'
            )
        }),
        ('인증 기간', {
            'fields': ('verification_start_date', 'verification_end_date')
        }),
        ('기록', {
            'fields': ('applied_at', 'verified_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def fandom_card_preview(self, obj):
        if obj.fandom_card:
            return format_html('<img src="{}" width="250" />', obj.fandom_card.url)
        return '업로드된 카드 없음'
    fandom_card_preview.short_description = '팬덤 카드 미리보기'

    @admin.action(description="✅ 공식 팬덤 인증 승인")
    def approve_fandom(self, request, queryset):
        from django.utils import timezone
        updated = queryset.update(
            is_verified_fandom=True,
            is_pending_verification=False,
            verification_failed=False,
            verified_at=timezone.now()
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

    actions = ['approve_fandom', 'reject_fandom']

@admin.register(BankProfile)
class BankProfileAdmin(admin.ModelAdmin):
    # 🔥 BankProfile 모델에 실제 있는 필드들만 사용
    list_display = (
        'user', 'bank_name', 'masked_account_number', 
        'account_holder', 'created_at'
    )
    
    # 🔥 BankProfile 모델의 실제 필드들로 필터 수정
    list_filter = ('bank_name', 'created_at', 'updated_at')
    
    search_fields = ('user__username', 'user__email', 'account_holder')
    
    # 🔥 BankProfile 모델의 실제 필드들로 readonly_fields 수정
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('사용자', {
            'fields': ('user',)
        }),
        ('계좌 정보', {
            'fields': ('bank_code', 'bank_name', 'account_holder')
        }),
        ('기록', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def masked_account_number(self, obj):
        return obj.get_masked_account_number()
    masked_account_number.short_description = '계좌번호'

@admin.register(AddressProfile)
class AddressProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'sido', 'sigungu', 'masked_address', 'created_at'
    )
    
    list_filter = ('sido', 'sigungu', 'created_at')
    
    search_fields = ('user__username', 'user__email', 'sido', 'sigungu')
    
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('사용자', {
            'fields': ('user',)
        }),
        ('지역 정보', {
            'fields': ('sido', 'sigungu')
        }),
        ('상세 주소', {
            'fields': ('full_address_display',),
            'description': '보안을 위해 상세 주소는 읽기 전용으로 표시됩니다.'
        }),
        ('기록', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def masked_address(self, obj):
        return obj.get_masked_address()
    masked_address.short_description = '주소'

    def full_address_display(self, obj):
        """관리자용 전체 주소 표시 (보안상 마스킹)"""
        return obj.get_masked_address()
    full_address_display.short_description = '전체 주소'

@admin.register(MannerReview)
class MannerReviewAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'target_user', 'rating', 'deal_again', 'created_at'
    )
    
    list_filter = ('rating', 'deal_again', 'created_at')
    
    search_fields = ('user__username', 'target_user__username')
    
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('user', 'target_user', 'chatroom')
        }),
        ('평가 내용', {
            'fields': (
                'rating', 'description_match', 'response_speed', 
                'politeness', 'deal_again'
            )
        }),
        ('기록', {
            'fields': ('created_at',)
        }),
    )