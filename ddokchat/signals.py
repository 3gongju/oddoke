from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.core.cache import cache
from .models import Message
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

@receiver(pre_save, sender=Message)
def cache_old_is_read_value(sender, instance, **kwargs):
    """변경 전 is_read 값을 캐시에 저장"""
    if instance.pk:
        try:
            old_instance = Message.objects.get(pk=instance.pk)
            cache.set(f'message_old_is_read_{instance.pk}', old_instance.is_read, 60)
        except Message.DoesNotExist:
            pass

@receiver(post_save, sender=Message)
def handle_is_read_change(sender, instance, created, **kwargs):
    if created:
        return  # 새 메시지 생성은 무시하고, 읽음 처리만 감지

    # 캐시에서 이전 값 가져오기
    old_is_read = cache.get(f'message_old_is_read_{instance.pk}')
    
    if old_is_read is not None and not old_is_read and instance.is_read:
        # is_read가 False → True로 변경된 경우
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{instance.room.room_code}",
            {
                "type": "read_update",
                "reader": instance.receiver.username,  # 읽은 사람은 receiver
                "message_id": instance.id,
            }
        )
        # 캐시 정리
        cache.delete(f'message_old_is_read_{instance.pk}')