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
    followings = models.ManyToManyField('self', related_name ='followers', symmetrical=False)
    bio = models.TextField(blank=True, null=True)
    
    # 팬덤 관련 (나중에 분리 예정)
    fandom_card = models.ImageField(upload_to='fandom_cards/', blank=True, null=True)
    fandom_artist = models.ForeignKey(Artist, on_delete=models.SET_NULL, blank=True, null=True)
    is_verified_fandom = models.BooleanField(default=False)
    is_pending_verification = models.BooleanField(default=False)
    verification_failed = models.BooleanField(default=False)
    
    # 계좌 관련 (나중에 분리 예정)
    bank_code = models.CharField(max_length=10, blank=True, null=True, verbose_name="은행 코드")
    bank_name = models.CharField(max_length=50, blank=True, null=True, verbose_name="은행명")
    account_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="계좌번호")
    account_holder = models.CharField(max_length=50, blank=True, null=True, verbose_name="예금주명")
    is_account_verified = models.BooleanField(default=False, verbose_name="계좌 인증 여부")
    account_registered_at = models.DateTimeField(blank=True, null=True, verbose_name="계좌 등록일")
    
    # 소셜 로그인 관련
    is_profile_completed = models.BooleanField(default=False, verbose_name="프로필 완성 여부")
    social_signup_completed = models.BooleanField(default=False, verbose_name="소셜 가입 완료 여부")
    is_temp_username = models.BooleanField(default=False, verbose_name="임시 사용자명 여부")  

    # 🔥 소셜 로그인 ID 저장 필드 추가
    kakao_id = models.CharField(max_length=50, blank=True, null=True, verbose_name="카카오 ID")
    naver_id = models.CharField(max_length=50, blank=True, null=True, verbose_name="네이버 ID")

    
    @property
    def display_name(self):
        """화면에 표시할 이름 반환"""
        # 🔥 소셜 가입이 완료된 경우 username 우선 사용
        if self.social_signup_completed and not self.is_temp_username:
            return self.username
        
        # first_name이 있으면 우선 사용
        if self.first_name and self.first_name.strip():
            return self.first_name
        
        # 임시 사용자명인 경우
        if self.is_temp_username:
            if self.username.startswith('temp_kakao_'):
                return "카카오 사용자"
            elif self.username.startswith('temp_naver_'):
                return "네이버 사용자"
            else:
                return "새로운 사용자"
        
        # 기본적으로 username 반환
        return self.username
    
    @property
    def is_social_user(self):
        """소셜 로그인 사용자인지 확인"""
        return self.username.startswith(('temp_kakao_', 'temp_naver_'))


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

# def default_profile_image():
#     return 'profile/default.png'

# profile_image = models.ImageField(upload_to='profile/', blank=True, null=True, default=default_profile_image)