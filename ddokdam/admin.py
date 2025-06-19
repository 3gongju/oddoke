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
        'post_title_display', 'status', 'created_at', 'processed_at'
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
    
    def post_title_display(self, obj):
        """게시글 제목 표시 (링크 포함)"""
        try:
            if obj.content_object:
                post = obj.content_object
                category = getattr(post, 'category_type', 'unknown')
                title = getattr(post, 'title', '제목 없음')
                return format_html(
                    '<a href="/ddokdam/{}/{}/" target="_blank">{}</a>',
                    category, post.id, title[:30] + ('...' if len(title) > 30 else '')
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
        """경미한 위반 - 경고 처리"""
        for report in queryset.filter(status='pending'):
            # 신고 상태 업데이트
            report.status = 'resolved'
            report.processed_at = timezone.now()
            report.processed_by = request.user
            report.admin_notes = f"경고 처리됨 - 관리자: {request.user.username}"
            
            # 사용자 제재 (3일)
            user = report.reported_user
            if user:
                from accounts.models import User
                User.objects.filter(id=user.id).update(
                    suspension_start=timezone.now(),
                    suspension_end=timezone.now() + timedelta(days=3),
                    suspension_reason=f"신고 처리 - {report.get_reason_display()}"
                )
                report.restriction_start = timezone.now()
                report.restriction_end = timezone.now() + timedelta(days=3)
            
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 경고 처리했습니다. (3일 제한)")
    
    @admin.action(description="🟠 일시정지 처리 (14일 제한)")
    def action_suspension(self, request, queryset):
        """중간 수준 위반 - 일시정지 및 게시글 삭제"""
        for report in queryset.filter(status='pending'):
            # 게시글 삭제
            try:
                if report.content_object:
                    report.content_object.delete()
            except Exception:
                pass
            
            # 신고 상태 업데이트
            report.status = 'resolved'
            report.processed_at = timezone.now()
            report.processed_by = request.user
            report.admin_notes = f"일시정지 처리 및 게시글 삭제됨 - 관리자: {request.user.username}"
            
            # 사용자 제재 (14일)
            user = report.reported_user
            if user:
                from accounts.models import User
                User.objects.filter(id=user.id).update(
                    suspension_start=timezone.now(),
                    suspension_end=timezone.now() + timedelta(days=14),
                    suspension_reason=f"신고 처리 - {report.get_reason_display()}"
                )
                report.restriction_start = timezone.now()
                report.restriction_end = timezone.now() + timedelta(days=14)
            
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 일시정지 처리했습니다. (14일 제한, 게시글 삭제)")
    
    @admin.action(description="🔴 영구정지 처리")
    def action_permanent_ban(self, request, queryset):
        """심각한 위반 - 영구 정지"""
        for report in queryset.filter(status='pending'):
            # 게시글 삭제
            try:
                if report.content_object:
                    report.content_object.delete()
            except Exception:
                pass
            
            # 신고 상태 업데이트
            report.status = 'resolved'
            report.processed_at = timezone.now()
            report.processed_by = request.user
            report.admin_notes = f"영구정지 처리 및 게시글 삭제됨 - 관리자: {request.user.username}"
            
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
                report.restriction_start = timezone.now()
                report.restriction_end = None
            
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 영구정지 처리했습니다. (게시글 삭제)")
    
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