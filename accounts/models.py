from django.db import models
from django.contrib.auth.models import AbstractUser
from django_resized import ResizedImageField
from artist.models import Artist
from django.conf import settings

# Create your models here.
class User(AbstractUser):
    email = models.EmailField(unique=True, error_messages={
        'unique': "이미 사용중인 이메일입니다."
    })
    username = models.CharField(max_length=20, unique=True, error_messages={
        'unique': "이미 사용 중인 닉네임입니다."
    })

    profile_image = ResizedImageField(
        size=[500, 500],
        crop=['middle', 'center'],
        upload_to='profile',
    )
    followings = models.ManyToManyField('self', related_name ='followers', symmetrical=False) # 반대쪽에서 어떻게 부를지
    bio = models.TextField(blank=True, null=True)
    fandom_card = models.ImageField(upload_to='fandom_cards/', blank=True, null=True)
    fandom_artist = models.ForeignKey(Artist, on_delete=models.SET_NULL, blank=True, null=True)
    is_verified_fandom = models.BooleanField(default=False)
    is_pending_verification = models.BooleanField(default=False)
    verification_failed = models.BooleanField(default=False)
    
    # 계좌 등록 관련 필드
    bank_code = models.CharField(max_length=10, blank=True, null=True, verbose_name="은행 코드")
    bank_name = models.CharField(max_length=50, blank=True, null=True, verbose_name="은행명")
    account_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="계좌번호")
    account_holder = models.CharField(max_length=50, blank=True, null=True, verbose_name="예금주명")
    is_account_verified = models.BooleanField(default=False, verbose_name="계좌 인증 여부")
    account_registered_at = models.DateTimeField(blank=True, null=True, verbose_name="계좌 등록일")

class MannerReview(models.Model):
    RATING_CHOICES = [(i, f'{i}점') for i in range(1, 6)]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='manner_reviews')
    target_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_received')
    chatroom = models.ForeignKey('ddokchat.ChatRoom', on_delete=models.CASCADE, null=True, blank=True)
    rating = models.IntegerField(choices=RATING_CHOICES, verbose_name="전반적인 거래 만족도")
    description_match = models.CharField(max_length=50, verbose_name="상품 상태 일치 여부")
    response_speed = models.CharField(max_length=50, verbose_name="응답 속도")
    politeness = models.CharField(max_length=50, verbose_name="메시지 말투")
    deal_again = models.CharField(max_length=10, verbose_name="재거래 의사")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} → {self.target_user} ({self.rating}점)"

def default_profile_image():
    return 'profile/default.png'  # media/profile/default.png 경로

profile_image = models.ImageField(upload_to='profile/', blank=True, null=True, default=default_profile_image)
