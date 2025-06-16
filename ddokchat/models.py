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
    """기본 메시지 모델 - 모든 메시지 타입의 공통 정보"""
    MESSAGE_TYPES = [
        ('text', '텍스트'),
        ('image', '이미지'),
        ('account_info', '계좌정보'),
        ('address_info', '주소정보'),
    ]
    
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_messages')
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES)
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def get_content(self):
        """메시지 타입에 따른 실제 내용 반환"""
        try:
            if self.message_type == 'text':
                return self.text_content
            elif self.message_type == 'image':
                return self.image_content
            elif self.message_type == 'account_info':
                return self.account_content
            elif self.message_type == 'address_info':
                return self.address_content
        except AttributeError:
            return None
        return None

    def __str__(self):
        content = self.get_content()
        if content:
            if self.message_type == 'text':
                return f"{self.sender.username}: {content.content[:50]}"
            elif self.message_type == 'image':
                return f"{self.sender.username}: [이미지]"
            elif self.message_type == 'account_info':
                return f"{self.sender.username}: [계좌정보]"
            elif self.message_type == 'address_info':
                return f"{self.sender.username}: [주소정보]"
        return f"{self.sender.username}: [메시지]"


class TextMessage(models.Model):
    """텍스트 메시지 상세 정보"""
    message = models.OneToOneField(Message, on_delete=models.CASCADE, related_name='text_content')
    content = models.TextField()

    def __str__(self):
        return f"텍스트: {self.content[:50]}"


class ImageMessage(models.Model):
    """이미지 메시지 상세 정보"""
    message = models.OneToOneField(Message, on_delete=models.CASCADE, related_name='image_content')
    image = models.ImageField(upload_to='chat_images/')
    caption = models.TextField(blank=True, help_text="이미지 설명 (선택사항)")

    def __str__(self):
        caption_text = f" - {self.caption[:30]}" if self.caption else ""
        return f"이미지{caption_text}"


class AccountInfoMessage(models.Model):
    """계좌 정보 메시지 상세 정보"""
    message = models.OneToOneField(Message, on_delete=models.CASCADE, related_name='account_content')
    bank_profile = models.ForeignKey(
        'accounts.BankProfile', 
        on_delete=models.SET_NULL,  # 계좌 삭제 시 NULL로 설정
        null=True,
        blank=True,
        related_name='chat_messages'
    )
    
    # 상태 관리
    is_deleted = models.BooleanField(default=False, help_text="거래 완료로 삭제된 정보")
    deleted_at = models.DateTimeField(null=True, blank=True, help_text="삭제된 시간")

    def get_display_info(self):
        """현재 상태에 따른 정보 반환"""
        if self.is_deleted:
            return {
                'is_deleted': True,
                'deleted_message': '거래 완료로 계좌정보가 삭제되었습니다'
            }
        elif not self.bank_profile:  # 계좌가 삭제된 경우
            return {
                'is_deleted': True,
                'deleted_message': '계좌 정보가 삭제되었습니다'
            }
        else:
            # 현재 계좌 정보 표시
            return {
                'is_deleted': False,
                'bank_name': self.bank_profile.bank_name,
                'account_number': self.bank_profile.account_number,
                'account_holder': self.bank_profile.account_holder,
                'bank_code': self.bank_profile.bank_code or '',
            }

    def __str__(self):
        if self.is_deleted:
            return "계좌정보: [삭제됨]"
        elif not self.bank_profile:
            return "계좌정보: [계좌 삭제됨]"
        else:
            return f"계좌정보: {self.bank_profile.bank_name} {self.bank_profile.account_number}"


class AddressMessage(models.Model):
    """주소 정보 메시지 상세 정보"""
    message = models.OneToOneField(Message, on_delete=models.CASCADE, related_name='address_content')
    address_profile = models.ForeignKey(
        'accounts.AddressProfile', 
        on_delete=models.SET_NULL,  # 주소 삭제 시 NULL로 설정
        null=True,
        blank=True,
        related_name='chat_messages'
    )
    
    # 상태 관리
    is_deleted = models.BooleanField(default=False, help_text="거래 완료로 삭제된 정보")
    deleted_at = models.DateTimeField(null=True, blank=True, help_text="삭제된 시간")

    def get_display_info(self):
        """현재 상태에 따른 정보 반환"""
        if self.is_deleted:
            return {
                'is_deleted': True,
                'deleted_message': '거래 완료로 주소정보가 삭제되었습니다'
            }
        elif not self.address_profile:  # 주소가 삭제된 경우
            return {
                'is_deleted': True,
                'deleted_message': '주소 정보가 삭제되었습니다'
            }
        else:
            # 현재 주소 정보 표시
            return {
                'is_deleted': False,
                'postal_code': self.address_profile.postal_code,
                'road_address': self.address_profile.road_address,
                'jibun_address': self.address_profile.jibun_address,
                'detail_address': self.address_profile.detail_address,
                'building_name': self.address_profile.building_name,
                'sido': self.address_profile.sido,
                'sigungu': self.address_profile.sigungu,
                'full_address': self.address_profile.full_address,
            }

    def __str__(self):
        if self.is_deleted:
            return "주소정보: [삭제됨]"
        elif not self.address_profile:
            return "주소정보: [주소 삭제됨]"
        else:
            return f"주소정보: {self.address_profile.sido} {self.address_profile.sigungu}"