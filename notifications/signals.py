from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from ddokfarm.models import FarmComment, FarmSellPost, FarmRentalPost, FarmSplitPost, SplitApplication
from ddokdam.models import DamComment, DamCommunityPost, DamMannerPost, DamBdaycafePost
from ddokchat.models import Message
from accounts.models import User, FandomProfile
from ddoksang.models import BdayCafe
from .models import Notification
from utils.redis_client import redis_client


# 1. ✅ 개선된 댓글 관련 알림 (그룹핑 적용)
@receiver(post_save, sender=FarmComment)
@receiver(post_save, sender=DamComment)
def create_comment_notification(sender, instance, created, **kwargs):
    """댓글 작성 시 알림 생성 (그룹핑 적용)"""
    if not created:
        return
    
    comment = instance
    
    # 대댓글인 경우
    if comment.parent:
        # 1. 원댓글 작성자에게 대댓글 알림
        if comment.parent.user != comment.user:
            Notification.create_notification(
                recipient=comment.parent.user,
                actor=comment.user,
                notification_type='reply',
                content_object=comment  # 댓글 객체 전달 (post 정보는 comment.post에서 추출)
            )
        
        # 2. 게시글 작성자에게도 알림
        # 단, 게시글 작성자가 대댓글 작성자나 원댓글 작성자와 다른 경우에만
        post = comment.post
        if (post and post.user != comment.user and 
            post.user != comment.parent.user):
            Notification.create_notification(
                recipient=post.user,
                actor=comment.user,
                notification_type='post_reply',
                content_object=comment
            )
    else:
        # 일반 댓글인 경우 - 게시글 작성자에게 알림
        post = comment.post
        if post and post.user != comment.user:
            Notification.create_notification(
                recipient=post.user,
                actor=comment.user,
                notification_type='comment',
                content_object=comment  # 댓글 객체 전달
            )


# 2. ✅ 개선된 채팅 관련 알림 (Redis 기반 위치 확인 + 그룹핑 적용)
@receiver(post_save, sender=Message)
def create_chat_notification(sender, instance, created, **kwargs):
    """채팅 메시지 발송 시 알림 생성 (Redis 기반 위치 확인 + 그룹핑 적용)"""
    if not created:
        return
    
    message = instance
    room = message.room
    
    # 상대방에게 알림 (구매자 ↔ 판매자)
    if room.buyer == message.sender:
        recipient = room.seller
    else:
        recipient = room.buyer
    
    # 받는 사람과 보내는 사람이 다를 때만 알림 생성
    if recipient != message.sender:
        # ✅ Redis에서 받는 사람의 현재 위치 확인
        try:
            current_room_code = redis_client.get_user_current_chatroom(recipient.id)
            
            # 받는 사람이 현재 해당 채팅방에 있다면 알림 생성하지 않음
            if current_room_code == room.room_code:
                print(f"🚫 알림 차단: 사용자 {recipient.username}이 현재 채팅방 {room.room_code}에 있음")
                return
            else:
                print(f"📨 알림 생성: 사용자 {recipient.username}이 다른 위치에 있음 (현재: {current_room_code}, 메시지: {room.room_code})")
                
        except Exception as e:
            print(f"❌ Redis 조회 실패, 기본 알림 생성: {e}")
            # Redis 오류 시에는 기본적으로 알림 생성
        
        # 🎯 그룹핑 로직 사용 (create_notification이 내부에서 처리)
        Notification.create_notification(
            recipient=recipient,
            actor=message.sender,
            notification_type='chat',
            content_object=room.post  # 거래 게시글을 참조
        )


# 3. 분철 관련 알림 - 기존과 동일
@receiver(post_save, sender=SplitApplication)
def create_split_application_notification(sender, instance, created, **kwargs):
    """분철 참여 신청 및 상태 변경 시 알림 생성"""
    application = instance
    post = application.post
    
    if created:
        # 새로운 참여 신청 - 총대(게시글 작성자)에게 알림
        if post.user != application.user:
            Notification.create_notification(
                recipient=post.user,
                actor=application.user,
                notification_type='split_application',
                content_object=post
            )
    else:
        # 상태 변경 - 신청자에게 알림
        if application.status == 'approved':
            Notification.create_notification(
                recipient=application.user,
                actor=post.user,
                notification_type='split_approved',
                content_object=post
            )
        elif application.status == 'rejected':
            Notification.create_notification(
                recipient=application.user,
                actor=post.user,
                notification_type='split_rejected',
                content_object=post
            )


# 4. 좋아요 관련 알림 - 기존과 동일
@receiver(m2m_changed, sender=FarmSellPost.like.through)
@receiver(m2m_changed, sender=FarmRentalPost.like.through)
@receiver(m2m_changed, sender=FarmSplitPost.like.through)
@receiver(m2m_changed, sender=DamCommunityPost.like.through)
@receiver(m2m_changed, sender=DamMannerPost.like.through)
@receiver(m2m_changed, sender=DamBdaycafePost.like.through)
def create_like_notification(sender, instance, action, pk_set, **kwargs):
    """좋아요 추가 시 알림 생성"""
    if action == 'post_add':
        post = instance
        for user_id in pk_set:
            try:
                liker = User.objects.get(pk=user_id)
                if post.user != liker:
                    Notification.create_notification(
                        recipient=post.user,
                        actor=liker,
                        notification_type='like',
                        content_object=post
                    )
            except User.DoesNotExist:
                continue


# 5. 팔로우 관련 알림 - 기존과 동일
@receiver(m2m_changed, sender=User.followings.through)
def create_follow_notification(sender, instance, action, pk_set, **kwargs):
    """팔로우 시 알림 생성"""
    if action == 'post_add':
        follower = instance  # 팔로우하는 사람
        
        for user_id in pk_set:
            try:
                followed_user = User.objects.get(pk=user_id)  # 팔로우 당하는 사람
                
                Notification.create_notification(
                    recipient=followed_user,
                    actor=follower,
                    notification_type='follow',
                    content_object=followed_user
                )
            except User.DoesNotExist:
                continue