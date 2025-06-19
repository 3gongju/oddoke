# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, MannerReview, FandomProfile, BankProfile, AddressProfile, PostReport  
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


@admin.register(PostReport)
class PostReportAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'reporter_link', 'reported_user_link', 'reason', 
        'post_title_display', 'app_name_display', 'status', 'created_at', 'processed_at'
    )
    
    list_filter = (
        'status', 'reason', 'created_at', 'processed_at'
    )
    
    search_fields = (
        'reporter__username', 'reported_user__username', 
        'additional_info'
    )
    
    readonly_fields = (
        'reporter', 'reported_user', 'content_type', 'object_id',
        'created_at', 'processed_at', 'post_preview'
    )
    
    fieldsets = (
        ('신고 정보', {
            'fields': (
                'reporter', 'reported_user', 'reason', 
                'additional_info', 'created_at'
            )
        }),
        ('게시글 정보', {
            'fields': ('content_type', 'object_id', 'post_preview')
        }),
        ('처리 정보', {
            'fields': (
                'status', 'admin_notes', 'processed_at', 
                'restriction_start', 'restriction_end'
            )
        }),
    )
    
    def reporter_link(self, obj):
        """신고자 링크"""
        if obj.reporter:
            return format_html(
                '<a href="/admin/accounts/user/{}/change/">{}</a>',
                obj.reporter.id, obj.reporter.username
            )
        return '-'
    reporter_link.short_description = '신고자'
    
    def reported_user_link(self, obj):
        """신고당한 사용자 링크"""
        if obj.reported_user:
            return format_html(
                '<a href="/admin/accounts/user/{}/change/">{}</a>',
                obj.reported_user.id, obj.reported_user.username
            )
        return '-'
    reported_user_link.short_description = '신고당한 사용자'
    
    def app_name_display(self, obj):
        """앱 이름 표시 (덕담/덕팜 구분)"""
        return obj.get_app_name()
    app_name_display.short_description = '앱'
    
    def post_title_display(self, obj):
        """게시글 제목 표시 (링크 포함)"""
        try:
            if obj.content_object:
                post = obj.content_object
                category = getattr(post, 'category_type', 'unknown')
                title = getattr(post, 'title', '제목 없음')
                app_name = obj.get_app_name()
                return format_html(
                    '<a href="/{}/{}/{}/" target="_blank">{}</a>',
                    app_name, category, post.id, title[:30] + ('...' if len(title) > 30 else '')
                )
        except Exception as e:
            print(f"post_title_display 오류: {e}")
        return '삭제된 게시글'
    post_title_display.short_description = '게시글'
    
    def post_preview(self, obj):
        """게시글 미리보기"""
        try:
            if obj.content_object:
                post = obj.content_object
                title = getattr(post, 'title', '제목 없음')
                content = getattr(post, 'content', '내용 없음')
                content_preview = content[:100] + ('...' if len(content) > 100 else '')
                
                # 첫 번째 이미지가 있으면 표시
                image_html = ''
                try:
                    if hasattr(post, 'images'):
                        first_image = post.images.first()
                        if first_image and hasattr(first_image, 'image'):
                            image_html = format_html(
                                '<br><img src="{}" style="max-width: 200px; max-height: 150px; margin-top: 10px;">',
                                first_image.image.url
                            )
                except Exception:
                    pass
                
                return format_html(
                    '<div style="max-width: 300px;">'
                    '<strong>제목:</strong> {}<br>'
                    '<strong>내용:</strong> {}'
                    '{}</div>',
                    title, content_preview, image_html
                )
        except Exception as e:
            print(f"post_preview 오류: {e}")
        return '삭제된 게시글'
    post_preview.short_description = '게시글 미리보기'
    
    @admin.action(description="🟡 경고 처리 (3일 제한)")
    def action_warning(self, request, queryset):
        """경미한 위반 - 경고 처리 + 게시글 삭제"""
        deleted_posts = 0
        suspended_users = 0
        
        for report in queryset.filter(status='pending'):
            # 🔥 신고된 게시글 삭제 (실제 게시글 삭제) - 추가됨
            try:
                if report.content_object:
                    post_title = getattr(report.content_object, 'title', '제목 없음')
                    report.content_object.delete()  # 실제 게시글 삭제
                    deleted_posts += 1
                    print(f"게시글 삭제됨: {post_title}")
            except Exception as e:
                print(f"게시글 삭제 실패: {e}")
            
            # 사용자 제재 (3일)
            user = report.reported_user
            if user:
                try:
                    user.suspend_user(f"신고 처리 - {report.get_reason_display()}", days=3)
                    suspended_users += 1
                    print(f"사용자 제재됨: {user.username}")
                except Exception as e:
                    print(f"사용자 제재 실패: {e}")
                
                report.restriction_start = timezone.now()
                report.restriction_end = timezone.now() + timedelta(days=3)
            
            # 신고 상태 업데이트
            report.status = 'resolved'
            report.processed_at = timezone.now()
            report.processed_by = request.user
            report.admin_notes = f"경고 처리 및 게시글 삭제됨 - 관리자: {request.user.username}"
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 경고 처리했습니다. (게시글 {deleted_posts}개 삭제, 사용자 {suspended_users}명 3일 제재)")
    
    @admin.action(description="🟠 일시정지 처리 (14일 제한)")
    def action_suspension(self, request, queryset):
        """중간 수준 위반 - 일시정지 및 게시글 삭제"""
        deleted_posts = 0
        suspended_users = 0
        
        for report in queryset.filter(status='pending'):
            # 🔥 신고된 게시글 삭제 (실제 게시글 삭제) - 강화된 삭제 로직
            try:
                if report.content_object:
                    post_title = getattr(report.content_object, 'title', '제목 없음')
                    post_id = report.content_object.id
                    
                    # 게시글과 관련된 이미지들도 함께 삭제
                    if hasattr(report.content_object, 'images'):
                        images = report.content_object.images.all()
                        for image in images:
                            try:
                                if image.image:
                                    image.image.delete()  # 실제 파일 삭제
                            except Exception:
                                pass
                    
                    report.content_object.delete()  # 실제 게시글 삭제
                    deleted_posts += 1
                    print(f"게시글 삭제됨: ID {post_id} - {post_title}")
            except Exception as e:
                print(f"게시글 삭제 실패: {e}")
            
            # 사용자 제재 (14일)
            user = report.reported_user
            if user:
                try:
                    user.suspend_user(f"신고 처리 - {report.get_reason_display()}", days=14)
                    suspended_users += 1
                    print(f"사용자 제재됨: {user.username}")
                except Exception as e:
                    print(f"사용자 제재 실패: {e}")
                
                report.restriction_start = timezone.now()
                report.restriction_end = timezone.now() + timedelta(days=14)
            
            # 신고 상태 업데이트
            report.status = 'resolved'
            report.processed_at = timezone.now()
            report.processed_by = request.user
            report.admin_notes = f"일시정지 처리 및 게시글 삭제됨 - 관리자: {request.user.username}"
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 처리했습니다. (게시글 {deleted_posts}개 삭제, 사용자 {suspended_users}명 14일 제재)")

    @admin.action(description="🔴 영구정지 처리")
    def action_permanent_ban(self, request, queryset):
        """심각한 위반 - 영구 정지"""
        deleted_posts = 0
        banned_users = 0
        
        for report in queryset.filter(status='pending'):
            # 🔥 신고된 게시글 삭제 (실제 게시글 삭제) - 강화된 삭제 로직
            try:
                if report.content_object:
                    post_title = getattr(report.content_object, 'title', '제목 없음')
                    post_id = report.content_object.id
                    
                    # 게시글과 관련된 이미지들도 함께 삭제
                    if hasattr(report.content_object, 'images'):
                        images = report.content_object.images.all()
                        for image in images:
                            try:
                                if image.image:
                                    image.image.delete()  # 실제 파일 삭제
                            except Exception:
                                pass
                    
                    report.content_object.delete()  # 실제 게시글 삭제
                    deleted_posts += 1
                    print(f"게시글 삭제됨: ID {post_id} - {post_title}")
            except Exception as e:
                print(f"게시글 삭제 실패: {e}")
            
            # 사용자 영구 제재
            user = report.reported_user
            if user:
                try:
                    user.suspend_user(f"신고 처리 - {report.get_reason_display()} (영구정지)")
                    user.is_active = False  # 🔥 계정 비활성화
                    user.save(update_fields=['is_active'])
                    banned_users += 1
                    print(f"사용자 영구정지됨: {user.username}")
                except Exception as e:
                    print(f"사용자 영구정지 실패: {e}")
                
                report.restriction_start = timezone.now()
                report.restriction_end = None
            
            # 신고 상태 업데이트
            report.status = 'resolved'
            report.processed_at = timezone.now()
            report.processed_by = request.user
            report.admin_notes = f"영구정지 처리 및 게시글 삭제됨 - 관리자: {request.user.username}"
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 처리했습니다. (게시글 {deleted_posts}개 삭제, 사용자 {banned_users}명 영구정지)")
    
    @admin.action(description="✅ 신고 기각")
    def action_dismiss(self, request, queryset):
        """신고 기각 처리"""
        for report in queryset.filter(status='pending'):
            report.status = 'rejected'
            report.processed_at = timezone.now()
            report.processed_by = request.user
            report.admin_notes = f"신고 기각됨 - 관리자: {request.user.username}"
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 기각 처리했습니다.")
    
    actions = [
        'action_warning', 'action_suspension', 
        'action_permanent_ban', 'action_dismiss'
    ]