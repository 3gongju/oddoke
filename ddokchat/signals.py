from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Message
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

@receiver(post_save, sender=Message)
def handle_is_read_change(sender, instance, created, **kwargs):
    if created:
        return  # 새 메시지 생성은 무시하고, 읽음 처리만 감지

    # DB에서 원래 값 불러오기 (변경 전 값 확인)
    old_instance = Message.objects.get(pk=instance.pk)
    if not old_instance.is_read and instance.is_read:
        # is_read 가 False → True 로 바뀐 경우에만 실행
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{instance.room.id}",  # consumer에서 사용되는 group_name과 맞춤
            {
                "type": "read_update",
                "reader": instance.sender.username,  # 또는 읽은 사람으로 지정
                "message_id": instance.id,
            }
        )
