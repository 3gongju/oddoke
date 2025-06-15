from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from ddokfarm.models import FarmComment, FarmSellPost, FarmRentalPost, FarmSplitPost, SplitApplication
from ddokdam.models import DamComment, DamCommunityPost, DamMannerPost, DamBdaycafePost
from ddokchat.models import Message
from accounts.models import User, FandomProfile
from ddoksang.models import BdayCafe
from .models import Notification


# 1. 댓글 관련 알림
@receiver(post_save, sender=FarmComment)
@receiver(post_save, sender=DamComment)
def create_comment_notification(sender, instance, created, **kwargs):
    """댓글 작성 시 알림 생성"""
    if not created:
        return
    
    comment = instance
    
    # 대댓글인 경우
    if comment.parent:
        # 1. 원댓글 작성자에게 대댓글 알림 (기존과 동일)
        if comment.parent.user != comment.user:
            Notification.create_notification(
                recipient=comment.parent.user,
                actor=comment.user,
                notification_type='reply',
                content_object=comment
            )
        
        # 2. 게시글 작성자에게도 알림 (새로 추가된 로직)
        # 단, 게시글 작성자가 대댓글 작성자나 원댓글 작성자와 다른 경우에만
        post = comment.post
        if (post and post.user != comment.user and 
            post.user != comment.parent.user):
            Notification.create_notification(
                recipient=post.user,
                actor=comment.user,
                notification_type='post_reply',  # 새로운 타입 추가
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
                content_object=comment  # ✅ 댓글 객체를 저장 (기존: post)
            )


# 2. 채팅 관련 알림
@receiver(post_save, sender=Message)
def create_chat_notification(sender, instance, created, **kwargs):
    """채팅 메시지 발송 시 알림 생성"""
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
        Notification.create_notification(
            recipient=recipient,
            actor=message.sender,
            notification_type='chat',
            content_object=room.post  # 거래 게시글을 참조
        )


# 3. 분철 관련 알림
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


# 4. 좋아요 관련 알림
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


# 5. 팔로우 관련 알림
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

# 6. 생일카페 승인 알림
@receiver(post_save, sender=BdayCafe)
def create_cafe_approval_notification(sender, instance, created, **kwargs):
    """생일카페 승인/거절 시 알림 생성"""
    if created:
        return  # 새로 생성된 경우는 제외
    
    cafe = instance
    
    # 상태가 변경되었는지 확인 (DB에서 이전 상태 조회)
    try:
        previous_state = BdayCafe.objects.get(id=cafe.id)
        
        # pending -> approved로 변경된 경우
        if cafe.status == 'approved' and hasattr(cafe, '_previous_status'):
            if cafe._previous_status == 'pending':
                Notification.create_notification(
                    recipient=cafe.submitted_by,
                    actor=cafe.verified_by or cafe.submitted_by,  # 승인자가 없으면 자기 자신
                    notification_type='cafe_approved',
                    content_object=cafe
                )
        
        # pending -> rejected로 변경된 경우  
        elif cafe.status == 'rejected' and hasattr(cafe, '_previous_status'):
            if cafe._previous_status == 'pending':
                Notification.create_notification(
                    recipient=cafe.submitted_by,
                    actor=cafe.verified_by or cafe.submitted_by,
                    notification_type='cafe_rejected', 
                    content_object=cafe
                )
                
    except BdayCafe.DoesNotExist:
        pass


# 7. 팬덤 인증 승인 알림
@receiver(post_save, sender=FandomProfile)
def create_fandom_verification_notification(sender, instance, created, **kwargs):
    """팬덤 인증 승인/거절 시 알림 생성"""
    if created:
        return  # 새로 생성된 경우는 제외
    
    fandom_profile = instance
    
    # 인증 상태가 변경되었는지 확인
    if hasattr(fandom_profile, '_previous_verification_status'):
        # pending -> verified로 변경된 경우
        if (fandom_profile.is_verified_fandom and 
            not fandom_profile.is_pending_verification and 
            fandom_profile._previous_verification_status == 'pending'):
            
            Notification.create_notification(
                recipient=fandom_profile.user,
                actor=fandom_profile.user,  # 시스템 알림이므로 자기 자신
                notification_type='fandom_verified',
                content_object=fandom_profile
            )
        
        # pending -> failed로 변경된 경우
        elif (fandom_profile.verification_failed and 
              not fandom_profile.is_pending_verification and
              fandom_profile._previous_verification_status == 'pending'):
            
            Notification.create_notification(
                recipient=fandom_profile.user,
                actor=fandom_profile.user,
                notification_type='fandom_rejected',
                content_object=fandom_profile
            )


# 상태 변경 추적을 위한 pre_save 시그널 추가
from django.db.models.signals import pre_save

@receiver(pre_save, sender=BdayCafe)
def track_cafe_status_change(sender, instance, **kwargs):
    """카페 상태 변경 추적"""
    if instance.pk:
        try:
            previous = BdayCafe.objects.get(pk=instance.pk)
            instance._previous_status = previous.status
        except BdayCafe.DoesNotExist:
            instance._previous_status = None


@receiver(pre_save, sender=FandomProfile)
def track_fandom_verification_change(sender, instance, **kwargs):
    """팬덤 인증 상태 변경 추적"""
    if instance.pk:
        try:
            previous = FandomProfile.objects.get(pk=instance.pk)
            # 이전 상태 판별
            if previous.is_verified_fandom:
                instance._previous_verification_status = 'verified'
            elif previous.is_pending_verification:
                instance._previous_verification_status = 'pending'
            elif previous.verification_failed:
                instance._previous_verification_status = 'failed'
            else:
                instance._previous_verification_status = 'none'
        except FandomProfile.DoesNotExist:
            instance._previous_verification_status = None