from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('comment', '댓글'),
        ('reply', '대댓글'),
        ('chat', '채팅'),
        ('split_application', '분철 참여 신청'),
        ('split_approved', '분철 승인'),
        ('split_rejected', '분철 반려'),
        ('like', '좋아요'),
        ('follow', '팔로우'),
    ]
    
    # 알림 받을 사용자
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='notifications',
        verbose_name='알림 받을 사용자'
    )
    
    # 알림을 발생시킨 사용자
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='sent_notifications',
        verbose_name='알림 발생 사용자'
    )
    
    # 알림 유형
    notification_type = models.CharField(
        max_length=20, 
        choices=NOTIFICATION_TYPES,
        verbose_name='알림 유형'
    )
    
    # 관련 객체 (게시글, 댓글 등) - Generic Foreign Key
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # 알림 메시지
    message = models.TextField(verbose_name='알림 메시지')
    
    # 읽음 여부
    is_read = models.BooleanField(default=False, verbose_name='읽음 여부')
    
    # 생성일
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = '알림'
        verbose_name_plural = '알림'
        
        # 중복 알림 방지용 인덱스 (같은 사용자가 같은 객체에 같은 행동 반복)
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'notification_type', 'content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"{self.recipient.username}: {self.notification_type} - {self.message[:50]}"
    
    @classmethod
    def create_notification(cls, recipient, actor, notification_type, content_object, extra_context=None):
        """
        알림 생성 메서드
        중복 알림 방지 로직 포함
        """
        if recipient == actor:
            return None  # 자기 자신에게는 알림 생성 안 함
            
        content_type = ContentType.objects.get_for_model(content_object)
        
        # 중복 알림 방지 (좋아요, 팔로우의 경우)
        if notification_type in ['like', 'follow']:
            existing = cls.objects.filter(
                recipient=recipient,
                actor=actor,
                notification_type=notification_type,
                content_type=content_type,
                object_id=content_object.id,
                created_at__gte=timezone.now() - timedelta(hours=1)  # 1시간 내 중복 방지
            ).first()
            
            if existing:
                # 기존 알림의 시간만 업데이트
                existing.created_at = timezone.now()
                existing.is_read = False
                existing.save()
                return existing
        
        # 메시지 생성
        message = cls._generate_message(notification_type, actor, content_object, extra_context)
        
        # 알림 생성
        notification = cls.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            content_type=content_type,
            object_id=content_object.id,
            message=message
        )
        
        return notification

    @classmethod
    def _generate_message(cls, notification_type, actor, content_object, extra_context=None):
        """알림 메시지 생성"""
        actor_name = actor.first_name or actor.username
        
        messages = {
            'comment': f'{actor_name}님이 회원님의 게시글에 댓글을 남겼습니다',
            'reply': f'{actor_name}님이 회원님의 댓글에 답글을 남겼습니다', 
            'chat': f'{actor_name}님이 메시지를 보냈습니다',
            'split_application': f'{actor_name}님이 분철에 참여 신청했습니다',
            'split_approved': '분철 참여 신청이 승인되었습니다',
            'split_rejected': '분철 참여 신청이 반려되었습니다',
            'like': f'{actor_name}님이 회원님의 게시글을 좋아합니다',
            'follow': f'{actor_name}님이 회원님을 팔로우합니다',
        }
        
        return messages.get(notification_type, f'{actor_name}님의 알림')
    
    @classmethod
    def cleanup_old_notifications(cls, days=30):
        """30일 이상 된 알림 삭제"""
        cutoff_date = timezone.now() - timedelta(days=days)
        deleted_count, _ = cls.objects.filter(created_at__lt=cutoff_date).delete()
        return deleted_count