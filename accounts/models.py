# accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django_resized import ResizedImageField
from django.utils import timezone
from datetime import timedelta
from .utils import AccountEncryption, AddressEncryption

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
   followings = models.ManyToManyField('self', related_name='followers', symmetrical=False)
   bio = models.TextField(blank=True, null=True)
   
   # 소셜 로그인 관련
   is_profile_completed = models.BooleanField(default=False, verbose_name="프로필 완성 여부")
   social_signup_completed = models.BooleanField(default=False, verbose_name="소셜 가입 완료 여부")
   is_temp_username = models.BooleanField(default=False, verbose_name="임시 사용자명 여부")
   
   # 편의 메서드들
   def get_fandom_profile(self):
       try:
           return self.fandom_profile
       except FandomProfile.DoesNotExist:
           return None
   
   def get_or_create_fandom_profile(self):
       profile, created = FandomProfile.objects.get_or_create(user=self)
       return profile
   
   def get_bank_profile(self):
       try:
           return self.bank_profile
       except BankProfile.DoesNotExist:
           return None
   
   def get_or_create_bank_profile(self):
       profile, created = BankProfile.objects.get_or_create(user=self)
       return profile
       
   def get_address_profile(self):
       try:
           return self.address_profile
       except AddressProfile.DoesNotExist:
           return None
   
   def get_or_create_address_profile(self):
       profile, created = AddressProfile.objects.get_or_create(user=self)
       return profile

   @property
   def display_name(self):
       if self.is_temp_username:
           return "새로운 사용자"
       return self.username
   
   @property
   def is_social_user(self):
       return self.username.startswith(('temp_kakao_', 'temp_naver_'))


class FandomProfile(models.Model):
   user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='fandom_profile')
   fandom_card = models.ImageField(upload_to='fandom_cards/', blank=True, null=True)
   fandom_artist = models.ForeignKey('artist.Artist', on_delete=models.SET_NULL, blank=True, null=True)
   
   # 인증 상태
   is_verified_fandom = models.BooleanField(default=False)
   is_pending_verification = models.BooleanField(default=False)
   verification_failed = models.BooleanField(default=False)
   
   # 사용자 입력 인증 기간
   verification_start_date = models.DateField(blank=True, null=True, verbose_name="인증 시작일")
   verification_end_date = models.DateField(blank=True, null=True, verbose_name="인증 만료일")
   
   # 기록
   applied_at = models.DateTimeField(blank=True, null=True)
   verified_at = models.DateTimeField(blank=True, null=True)
   created_at = models.DateTimeField(auto_now_add=True)
   updated_at = models.DateTimeField(auto_now=True)
   
   @property
   def is_verification_expired(self):
       """인증이 만료되었는지 확인"""
       if not self.verification_end_date:
           return False
       return timezone.now().date() > self.verification_end_date
   
   @property
   def days_until_expiration(self):
       """만료까지 남은 일수"""
       if not self.verification_end_date:
           return None
       today = timezone.now().date()
       if today > self.verification_end_date:
           return 0
       return (self.verification_end_date - today).days
   
   @property
   def needs_renewal_alert(self):
       """갱신 알림이 필요한지 확인 (7일 전)"""
       if not self.verification_end_date or not self.is_verified_fandom:
           return False
       
       today = timezone.now().date()
       alert_date = self.verification_end_date - timedelta(days=7)
       return today >= alert_date and today <= self.verification_end_date
   
   @property
   def verification_status(self):
       """현재 인증 상태"""
       if self.is_verification_expired:
           return 'expired'
       elif self.is_verified_fandom:
           return 'verified'
       elif self.is_pending_verification:
           return 'pending'
       elif self.verification_failed:
           return 'failed'
       else:
           return 'none'
   
   def expire_verification(self):
       """인증 만료 처리"""
       self.is_verified_fandom = False
       self.save()
   
   def renew_verification(self, start_date, end_date):
       """인증 갱신"""
       self.verification_start_date = start_date
       self.verification_end_date = end_date
       self.is_pending_verification = True
       self.verification_failed = False
       self.applied_at = timezone.now()
       self.save()
   
   def __str__(self):
       return f"{self.user.username}의 팬덤 프로필"


class BankProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='bank_profile')
    bank_code = models.CharField(max_length=10)
    bank_name = models.CharField(max_length=50)
    _encrypted_account_number = models.TextField()
    account_holder = models.CharField(max_length=50)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def account_number(self):
        return AccountEncryption.decrypt(self._encrypted_account_number)
    
    @account_number.setter
    def account_number(self, value):
        self._encrypted_account_number = AccountEncryption.encrypt(value)
    
    def get_masked_account_number(self):
        """마스킹된 계좌번호 반환"""
        account = self.account_number
        if account and len(account) > 4:
            return '****' + account[-4:]
        return '****'
    
    def __str__(self):
        return f"{self.user.username}의 계좌 ({self.bank_name})"


class AddressProfile(models.Model):
   user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='address_profile')
   
   # 암호화 저장 필드들
   _encrypted_postal_code = models.TextField(blank=True, null=True)
   _encrypted_jibun_address = models.TextField(blank=True, null=True)
   _encrypted_road_address = models.TextField(blank=True, null=True)
   _encrypted_detail_address = models.TextField(blank=True, null=True)
   _encrypted_building_name = models.TextField(blank=True, null=True)
   
   # 검색용 (암호화 안 함)
   sido = models.CharField(max_length=20)
   sigungu = models.CharField(max_length=50)
   
   created_at = models.DateTimeField(auto_now_add=True)
   updated_at = models.DateTimeField(auto_now=True)
   
   # 프로퍼티들
   @property
   def postal_code(self):
       return AddressEncryption.decrypt(self._encrypted_postal_code)
   
   @postal_code.setter
   def postal_code(self, value):
       self._encrypted_postal_code = AddressEncryption.encrypt(value)
   
   @property
   def jibun_address(self):
       return AddressEncryption.decrypt(self._encrypted_jibun_address)
   
   @jibun_address.setter
   def jibun_address(self, value):
       self._encrypted_jibun_address = AddressEncryption.encrypt(value)
   
   @property
   def road_address(self):
       return AddressEncryption.decrypt(self._encrypted_road_address)
   
   @road_address.setter
   def road_address(self, value):
       self._encrypted_road_address = AddressEncryption.encrypt(value)
   
   @property
   def detail_address(self):
       return AddressEncryption.decrypt(self._encrypted_detail_address)
   
   @detail_address.setter
   def detail_address(self, value):
       self._encrypted_detail_address = AddressEncryption.encrypt(value)
   
   @property
   def building_name(self):
       return AddressEncryption.decrypt(self._encrypted_building_name)
   
   @building_name.setter
   def building_name(self, value):
       self._encrypted_building_name = AddressEncryption.encrypt(value)
   
   @property
   def full_address(self):
       """전체 주소 조합"""
       base = self.road_address if self.road_address else self.jibun_address
       if base and self.detail_address:
           return f"{base} {self.detail_address}"
       return base
   
   def get_masked_address(self):
       """마스킹된 주소 (배송지 표시용)"""
       if self.road_address:
           parts = self.road_address.split()
           if len(parts) >= 3:
               return f"{parts[0]} {parts[1]} {parts[2][:3]}***"
       return f"{self.sido} {self.sigungu} ***"
   
   def __str__(self):
       return f"{self.user.username}의 주소 ({self.sido} {self.sigungu})"


class MannerReview(models.Model):
   RATING_CHOICES = [(i, f'{i}점') for i in range(1, 6)]

   user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='manner_reviews')
   target_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_received')
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
   return 'profile/default.png'

profile_image = models.ImageField(upload_to='profile/', blank=True, null=True, default=default_profile_image)