from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        'recipient', 'actor', 'notification_type', 
        'is_read', 'created_at', 'message_preview'
    )
    list_filter = (
        'notification_type', 'is_read', 'created_at',
        'content_type'
    )
    search_fields = ('recipient__username', 'actor__username', 'message')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    
    def message_preview(self, obj):
        return obj.message[:50] + '...' if len(obj.message) > 50 else obj.message
    message_preview.short_description = '메시지 미리보기'
    
    @admin.action(description="선택된 알림을 읽음으로 표시")
    def mark_as_read(self, request, queryset):
        updated = queryset.update(is_read=True)
        self.message_user(request, f"{updated}개의 알림이 읽음으로 표시되었습니다.")
    
    @admin.action(description="30일 이상 된 알림 삭제")
    def cleanup_old_notifications(self, request, queryset):
        deleted_count = Notification.cleanup_old_notifications()
        self.message_user(request, f"{deleted_count}개의 오래된 알림이 삭제되었습니다.")
    
    actions = [mark_as_read, cleanup_old_notifications]