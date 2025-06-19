from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from datetime import timedelta
from .models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment, DamPostReport

admin.site.register(DamCommunityPost)
admin.site.register(DamMannerPost)
admin.site.register(DamBdaycafePost)
admin.site.register(DamComment) 


@admin.register(DamPostReport)
class DamPostReportAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'reporter_link', 'reported_user_link', 'reason', 
        'post_link', 'status', 'created_at', 'processed_at'
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
                'status', 'admin_note', 'processed_at', 
                'suspension_start', 'suspension_end'
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
    
    def post_link(self, obj):
        """게시글 링크"""
        if obj.content_object:
            post = obj.content_object
            category = post.category_type
            return format_html(
                '<a href="/ddokdam/{}/{}/" target="_blank">{}</a>',
                category, post.id, post.title[:30] + ('...' if len(post.title) > 30 else '')
            )
        return '삭제된 게시글'
    post_link.short_description = '게시글'
    
    def post_preview(self, obj):
        """게시글 미리보기"""
        if obj.content_object:
            post = obj.content_object
            content_preview = post.content[:100] + ('...' if len(post.content) > 100 else '')
            
            # 첫 번째 이미지가 있으면 표시
            first_image = post.images.first()
            image_html = ''
            if first_image:
                image_html = format_html(
                    '<br><img src="{}" style="max-width: 200px; max-height: 150px; margin-top: 10px;">',
                    first_image.image.url
                )
            
            return format_html(
                '<div style="max-width: 300px;">'
                '<strong>제목:</strong> {}<br>'
                '<strong>내용:</strong> {}'
                '{}</div>',
                post.title, content_preview, image_html
            )
        return '삭제된 게시글'
    post_preview.short_description = '게시글 미리보기'
    
    @admin.action(description="🟡 경고 처리 (1-7일 제한)")
    def action_warning(self, request, queryset):
        """경미한 위반 - 경고 처리"""
        for report in queryset.filter(status='pending'):
            # 신고 상태 업데이트
            report.status = 'processed'
            report.processed_at = timezone.now()
            report.admin_note = f"경고 처리됨 - 관리자: {request.user.username}"
            
            # 사용자 제재 (3일)
            user = report.reported_user
            if user:
                from accounts.models import User
                User.objects.filter(id=user.id).update(
                    suspension_start=timezone.now(),
                    suspension_end=timezone.now() + timedelta(days=3),
                    suspension_reason=f"신고 처리 - {report.get_reason_display()}"
                )
                report.suspension_start = timezone.now()
                report.suspension_end = timezone.now() + timedelta(days=3)
            
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 경고 처리했습니다. (3일 제한)")
    
    @admin.action(description="🟠 일시정지 처리 (7-30일 제한)")
    def action_suspension(self, request, queryset):
        """중간 수준 위반 - 일시정지 및 게시글 삭제"""
        for report in queryset.filter(status='pending'):
            # 게시글 삭제
            if report.content_object:
                report.content_object.delete()
            
            # 신고 상태 업데이트
            report.status = 'processed'
            report.processed_at = timezone.now()
            report.admin_note = f"일시정지 처리 및 게시글 삭제됨 - 관리자: {request.user.username}"
            
            # 사용자 제재 (14일)
            user = report.reported_user
            if user:
                from accounts.models import User
                User.objects.filter(id=user.id).update(
                    suspension_start=timezone.now(),
                    suspension_end=timezone.now() + timedelta(days=14),
                    suspension_reason=f"신고 처리 - {report.get_reason_display()}"
                )
                report.suspension_start = timezone.now()
                report.suspension_end = timezone.now() + timedelta(days=14)
            
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 일시정지 처리했습니다. (14일 제한, 게시글 삭제)")
    
    @admin.action(description="🔴 영구정지 처리")
    def action_permanent_ban(self, request, queryset):
        """심각한 위반 - 영구 정지"""
        for report in queryset.filter(status='pending'):
            # 게시글 삭제
            if report.content_object:
                report.content_object.delete()
            
            # 신고 상태 업데이트
            report.status = 'processed'
            report.processed_at = timezone.now()
            report.admin_note = f"영구정지 처리 및 게시글 삭제됨 - 관리자: {request.user.username}"
            
            # 사용자 영구 제재
            user = report.reported_user
            if user:
                from accounts.models import User
                User.objects.filter(id=user.id).update(
                    is_active=False,
                    suspension_start=timezone.now(),
                    suspension_end=None,  # 영구정지는 종료일 없음
                    suspension_reason=f"신고 처리 - {report.get_reason_display()} (영구정지)"
                )
                report.suspension_start = timezone.now()
                report.suspension_end = None
            
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 영구정지 처리했습니다. (게시글 삭제)")
    
    @admin.action(description="✅ 신고 기각")
    def action_dismiss(self, request, queryset):
        """신고 기각 처리"""
        for report in queryset.filter(status='pending'):
            report.status = 'dismissed'
            report.processed_at = timezone.now()
            report.admin_note = f"신고 기각됨 - 관리자: {request.user.username}"
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 기각 처리했습니다.")
    
    actions = [
        'action_warning', 'action_suspension', 
        'action_permanent_ban', 'action_dismiss'
    ]