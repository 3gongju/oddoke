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
        ('post_reply', '게시글 답글'),
        ('chat', '채팅'),
        ('split_application', '분철 참여 신청'),
        ('split_approved', '분철 승인'),
        ('split_rejected', '분철 반려'),
        ('like', '좋아요'),
        ('follow', '팔로우'),
        ('cafe_approved', '생일카페 승인'),
        ('cafe_rejected', '생일카페 반려'),
        ('fandom_verified', '팬덤 인증 승인'),
        ('fandom_rejected', '팬덤 인증 반려'),
    ]
    
    # ✅ 통합 읽음 처리 대상 알림 타입
    CONTENT_RELATED_NOTIFICATIONS = ['comment', 'reply', 'post_reply', 'like']
    
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
    
    # ✅ 채팅/댓글 알림 그룹핑을 위한 필드들
    message_count = models.PositiveIntegerField(default=1, verbose_name='메시지 개수')
    last_sender_name = models.CharField(max_length=100, blank=True, verbose_name='마지막 발신자')
    
    # 읽음 여부
    is_read = models.BooleanField(default=False, verbose_name='읽음 여부')
    
    # 생성일
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = '알림'
        verbose_name_plural = '알림'
        
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'notification_type', 'content_type', 'object_id']),
            models.Index(fields=['recipient', '-created_at']),
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
        
        # ✅ 채팅 알림은 별도 로직으로 처리
        if notification_type == 'chat':
            return cls.create_or_update_chat_notification(recipient, actor, content_object)
        
        # ✅ 댓글 알림도 그룹핑 처리 추가
        if notification_type in ['comment', 'reply', 'post_reply']:
            return cls.create_or_update_comment_notification(recipient, actor, notification_type, content_object)

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
    def create_or_update_comment_notification(cls, recipient, actor, notification_type, comment_object):
        """
        ✅ 댓글 알림 생성 또는 업데이트 (연속성 기반 그룹핑)
        """
        if recipient == actor:
            return None
            
        # 댓글 객체에서 게시글 가져오기
        post = comment_object.post
        
        # 1️⃣ 바로 직전 알림 확인 (읽지 않은 것만)
        last_notification = cls.objects.filter(
            recipient=recipient,
            is_read=False
        ).order_by('-created_at').first()
        
        post_content_type = ContentType.objects.get_for_model(post)
        
        # 2️⃣ 그룹핑 조건 체크
        should_group = (
            last_notification and
            last_notification.notification_type == notification_type and  # 같은 댓글 타입
            last_notification.content_type == post_content_type and  # 같은 게시글 타입
            last_notification.object_id == post.id and  # 같은 게시글
            last_notification.actor == actor and  # 같은 사용자
            timezone.now() - last_notification.created_at < timedelta(hours=2)  # 2시간 이내
        )
        
        if should_group:
            # 3️⃣ 기존 알림 업데이트
            return cls._update_comment_notification(last_notification, actor, post)
        else:
            # 4️⃣ 새 알림 생성
            return cls._create_new_comment_notification(recipient, actor, notification_type, post)
    
    @classmethod
    def _update_comment_notification(cls, notification, actor, post):
        """기존 댓글 알림 업데이트"""
        notification.message_count += 1
        notification.last_sender_name = actor.first_name or actor.username
        notification.created_at = timezone.now()  # 시간 업데이트로 최상단 유지
        notification.is_read = False  # 읽음 상태 초기화
        
        # 게시글 제목 처리 (20자 제한)
        title = post.title[:20] + "..." if len(post.title) > 20 else post.title
        
        # 메시지 업데이트
        comment_type_map = {
            'comment': '댓글',
            'reply': '답글', 
            'post_reply': '답글'
        }
        comment_type_text = comment_type_map.get(notification.notification_type, '댓글')
        
        if notification.message_count == 1:
            notification.message = f'{notification.last_sender_name}님이 \'{title}\'에 {comment_type_text}을 남겼습니다'
        else:
            notification.message = f'{notification.last_sender_name}님이 \'{title}\'에 {comment_type_text} {notification.message_count}개를 남겼습니다'
        
        notification.save()
        return notification
    
    @classmethod  
    def _create_new_comment_notification(cls, recipient, actor, notification_type, post):
        """새 댓글 알림 생성"""
        post_content_type = ContentType.objects.get_for_model(post)
        sender_name = actor.first_name or actor.username
        
        # 게시글 제목 처리 (20자 제한)
        title = post.title[:20] + "..." if len(post.title) > 20 else post.title
        
        # 댓글 타입별 메시지
        comment_type_map = {
            'comment': '댓글',
            'reply': '답글',
            'post_reply': '답글'
        }
        comment_type_text = comment_type_map.get(notification_type, '댓글')
        
        message = f'{sender_name}님이 \'{title}\'에 {comment_type_text}을 남겼습니다'
        
        notification = cls.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            content_type=post_content_type,
            object_id=post.id,  # 게시글 ID 저장 (댓글 ID가 아님)
            message=message,
            message_count=1,
            last_sender_name=sender_name
        )
        
        return notification
        
    @classmethod
    def create_or_update_chat_notification(cls, recipient, actor, room_post):
        """
        ✅ 채팅 알림 생성 또는 업데이트 (연속성 기반 그룹핑)
        """
        if recipient == actor:
            return None
            
        # 1️⃣ 바로 직전 알림 확인 (읽지 않은 것만)
        last_notification = cls.objects.filter(
            recipient=recipient,
            is_read=False
        ).order_by('-created_at').first()
        
        content_type = ContentType.objects.get_for_model(room_post)
        
        # 2️⃣ 그룹핑 조건 체크
        should_group = (
            last_notification and
            last_notification.notification_type == 'chat' and
            last_notification.content_type == content_type and
            last_notification.object_id == room_post.id and
            timezone.now() - last_notification.created_at < timedelta(hours=24)  # 24시간 이내
        )
        
        if should_group:
            # 3️⃣ 기존 알림 업데이트
            return cls._update_chat_notification(last_notification, actor)
        else:
            # 4️⃣ 새 알림 생성
            return cls._create_new_chat_notification(recipient, actor, room_post)
    
    @classmethod
    def _update_chat_notification(cls, notification, new_sender):
        """기존 채팅 알림 업데이트"""
        notification.message_count += 1
        notification.last_sender_name = new_sender.first_name or new_sender.username
        notification.actor = new_sender  # 마지막 발신자로 업데이트
        notification.created_at = timezone.now()  # 시간 업데이트로 최상단 유지
        notification.is_read = False  # 읽음 상태 초기화
        
        # 메시지 업데이트
        if notification.message_count == 1:
            notification.message = f'{notification.last_sender_name}님이 메시지를 보냈습니다'
        else:
            notification.message = f'{notification.last_sender_name}님이 메시지 {notification.message_count}개를 보냈습니다'
        
        notification.save()
        return notification
    
    @classmethod  
    def _create_new_chat_notification(cls, recipient, actor, room_post):
        """새 채팅 알림 생성"""
        content_type = ContentType.objects.get_for_model(room_post)
        sender_name = actor.first_name or actor.username
        
        notification = cls.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type='chat',
            content_type=content_type,
            object_id=room_post.id,
            message=f'{sender_name}님이 메시지를 보냈습니다',
            message_count=1,
            last_sender_name=sender_name
        )
        
        return notification

    @classmethod
    def _generate_message(cls, notification_type, actor, content_object, extra_context=None):
        """알림 메시지 생성"""
        actor_name = actor.first_name or actor.username
        
        # 댓글 관련 알림은 별도 로직에서 처리하므로 여기서는 기본 메시지만
        if notification_type in ['comment', 'reply', 'post_reply']:
            if hasattr(content_object, 'post'):
                post = content_object.post
            else:
                post = content_object
            
            title = post.title[:20] + "..." if len(post.title) > 20 else post.title
            
            comment_type_map = {
                'comment': '댓글',
                'reply': '답글',
                'post_reply': '답글'
            }
            comment_type_text = comment_type_map.get(notification_type, '댓글')
            
            return f'{actor_name}님이 \'{title}\'에 {comment_type_text}을 남겼습니다'
        
        # ✅ 좋아요 알림에 게시글 제목 추가
        if notification_type == 'like':
            title = content_object.title[:20] + "..." if len(content_object.title) > 20 else content_object.title
            return f'{actor_name}님이 \'{title}\'를 좋아합니다'
        
        # ✅ 분철 관련 알림에 게시글 제목 추가
        if notification_type in ['split_application', 'split_approved', 'split_rejected']:
            title = content_object.title[:20] + "..." if len(content_object.title) > 20 else content_object.title
            
            split_messages = {
                'split_application': f'{actor_name}님이 \'{title}\' 분철에 참여 신청했습니다',
                'split_approved': f'\'{title}\' 분철 참여 신청이 승인되었습니다',
                'split_rejected': f'\'{title}\' 분철 참여 신청이 반려되었습니다',
            }
            return split_messages.get(notification_type, f'{actor_name}님의 분철 알림')
        
        # 기타 알림들
        messages = {
            'chat': f'{actor_name}님이 메시지를 보냈습니다',  # 이제 사용되지 않음 (별도 로직)
            'follow': f'{actor_name}님이 회원님을 팔로우합니다',
            'cafe_approved': f'등록하신 생일카페 "{getattr(content_object, "cafe_name", "")}"가 승인되었습니다',
            'cafe_rejected': f'등록하신 생일카페 "{getattr(content_object, "cafe_name", "")}"가 반려되었습니다',
            'fandom_verified': f'{getattr(getattr(content_object, "fandom_artist", None), "display_name", "아티스트")} 공식 팬덤 인증이 승인되었습니다',
            'fandom_rejected': f'{getattr(getattr(content_object, "fandom_artist", None), "display_name", "아티스트")} 공식 팬덤 인증이 거절되었습니다',
        }
        
        return messages.get(notification_type, f'{actor_name}님의 알림')
    
    # ✅ 새로운 읽음 처리 로직
    def mark_as_read_with_related(self):
        """
        ✅ 알림 읽음 처리 - 타입에 따라 통합/개별 처리 분리
        """
        if self.notification_type in self.CONTENT_RELATED_NOTIFICATIONS:
            # 게시글 콘텐츠 관련 알림 → 통합 읽음 처리
            try:
                related_count = self.mark_content_notifications_read(
                    user=self.recipient,
                    post=self.content_object,
                    notification_types=self.CONTENT_RELATED_NOTIFICATIONS
                )
                return related_count
            except Exception as e:
                print(f"콘텐츠 관련 알림 통합 읽음 처리 오류: {e}")
                # 오류 시 개별 처리로 폴백
                self.is_read = True
                self.save()
                return 1
        
        elif self.notification_type == 'chat':
            # 채팅 알림 → 상대방별 개별 읽음 처리
            try:
                related_count = self.mark_chat_notifications_read(
                    user=self.recipient,
                    room_post=self.content_object,
                    sender=self.actor
                )
                return related_count
            except Exception as e:
                print(f"채팅 알림 개별 읽음 처리 오류: {e}")
                # 오류 시 개별 처리로 폴백
                self.is_read = True
                self.save()
                return 1
        
        else:
            # 기타 알림 → 개별 읽음 처리
            self.is_read = True
            self.save()
            return 1

    @classmethod
    def mark_content_notifications_read(cls, user, post, notification_types):
        """
        ✅ 게시글 콘텐츠 관련 알림들만 읽음 처리 (댓글, 좋아요 등)
        """
        try:
            content_type = ContentType.objects.get_for_model(post)
            
            updated_count = cls.objects.filter(
                recipient=user,
                content_type=content_type,
                object_id=post.id,
                notification_type__in=notification_types,  # 지정된 타입만
                is_read=False
            ).update(is_read=True)
            
            return updated_count
            
        except Exception as e:
            print(f"콘텐츠 알림 읽음 처리 오류: {e}")
            return 0

    @classmethod
    def mark_chat_notifications_read(cls, user, room_post, sender=None):
        """
        ✅ 채팅 알림 읽음 처리 - 특정 상대방과의 채팅만
        """
        try:
            content_type = ContentType.objects.get_for_model(room_post)
            
            filter_kwargs = {
                'recipient': user,
                'notification_type': 'chat',
                'content_type': content_type,
                'object_id': room_post.id,
                'is_read': False
            }
            
            # 특정 발신자와의 채팅만 읽음 처리
            if sender:
                filter_kwargs['actor'] = sender
            
            updated_count = cls.objects.filter(**filter_kwargs).update(is_read=True)
            return updated_count
            
        except Exception as e:
            print(f"채팅 알림 읽음 처리 오류: {e}")
            return 0
    
    @classmethod
    def cleanup_old_notifications(cls, days=30):
        """30일 이상 된 알림 삭제"""
        cutoff_date = timezone.now() - timedelta(days=days)
        deleted_count, _ = cls.objects.filter(created_at__lt=cutoff_date).delete()
        return deleted_count