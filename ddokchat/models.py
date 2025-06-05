from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
import uuid

# Create your models here.

class ChatRoom(models.Model):
    # 거래글: FarmSellPost, FarmRentalPost, FarmSplitPost 중 하나
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE) # 포스트 모델 선택
    object_id = models.PositiveIntegerField() # 모델의 id
    post = GenericForeignKey('content_type', 'object_id') # 위 두개 합치기

    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='chat_buyer', on_delete=models.CASCADE)
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='chat_seller', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    buyer_completed = models.BooleanField(default=False)  # 구매자 거래 완료 여부
    seller_completed = models.BooleanField(default=False)  # 판매자 거래 완료 
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False) # 채팅방 고유 난수 부여
    class Meta:
        unique_together = ('content_type', 'object_id', 'buyer')  # 구매자는 같은 글에 대해 1방만

    @property
    def is_fully_completed(self):
        return self.buyer_completed and self.seller_completed
        
    def __str__(self):
        return f"Post#{self.object_id} | {self.buyer.username} ↔ {self.seller.username}"


class Message(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    image = models.ImageField(upload_to='chat_images/', blank=True, null=True) # 채팅방 이미지
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"[{self.timestamp}] {self.sender.username}: {self.content}"
