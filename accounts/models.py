from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from datetime import timedelta
from .utils import BankEncryption, AddressEncryption
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation 
import os
from datetime import datetime

def get_banner_display_days():
    """배너 표시 일수 반환 (설정값 또는 기본값)"""
    return getattr(settings, 'BANNER_DISPLAY_DAYS', 3)

def get_banner_cost_points():
    """배너 신청 비용 반환 (설정값 또는 기본값)"""
    return getattr(settings, 'BANNER_COST_POINTS', 1000)

def profile_image_upload(instance, filename):
    now = datetime.now()
    return os.path.join('accounts/profile', now.strftime('%y/%m'), filename)

def banner_image_upload(instance, filename):
    now = datetime.now()
    return os.path.join('accounts/banners', now.strftime('%y/%m'), filename)

def fandom_card_upload(instance, filename):
    now = datetime.now()
    return os.path.join('accounts/fandom_cards', now.strftime('%y/%m'), filename)

class User(AbstractUser):
    email = models.EmailField(unique=True, error_messages={
       'unique': "이미 사용중인 이메일입니다."
    })
    username = models.CharField(max_length=20, unique=True, error_messages={
       'unique': "이미 사용 중인 닉네임입니다."
    })
   
    profile_image = models.ImageField(
        upload_to=profile_image_upload,
        default='default/profile.png',
        blank=True, 
        null=True,
        
    )
    followings = models.ManyToManyField('self', related_name='followers', symmetrical=False)
    bio = models.TextField(blank=True, null=True)

    is_profile_completed = models.BooleanField(default=False, verbose_name="프로필 완성 여부")

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

    # 소셜 로그인 관련 편의 메서드들
    def get_social_account(self):
        try:
            return self.social_account
        except SocialAccount.DoesNotExist:
            return None
    
    def get_or_create_social_account(self):
        account, created = SocialAccount.objects.get_or_create(user=self)
        return account

    # 제재 관련 편의 메서드들
    def get_user_suspension(self):
        try:
            return self.user_suspension
        except UserSuspension.DoesNotExist:
            return None
    
    def get_or_create_user_suspension(self):
        suspension, created = UserSuspension.objects.get_or_create(user=self)
        return suspension

    # 표시 이름 - username만 사용
    @property
    def display_name(self):
        """화면에 표시할 이름 - username만 사용"""
        return self.username
   
    # 소셜 로그인 관련 프로퍼티들 (위임)
    @property
    def is_social_user(self):
        """소셜 로그인 사용자인지 확인"""
        social_account = self.get_social_account()
        return social_account.is_social_user if social_account else False

    @property
    def social_provider(self):
        """소셜 로그인 제공자 반환"""
        social_account = self.get_social_account()
        return social_account.provider if social_account else None

    @property
    def social_signup_completed(self):
        """소셜 가입 완료 여부"""
        social_account = self.get_social_account()
        return social_account.signup_completed if social_account else False

    # 제재 관련 프로퍼티들 (위임)
    @property
    def is_suspended(self):
        """현재 제재 중인지 확인"""
        user_suspension = self.get_user_suspension()
        return user_suspension.is_suspended if user_suspension else False

    @property
    def suspension_status(self):
        """제재 상태 문자열 반환"""
        user_suspension = self.get_user_suspension()
        return user_suspension.status_display if user_suspension else "정상"

    def suspend_user(self, reason, days=None, end_datetime=None):
        """사용자 제재"""
        suspension = self.get_or_create_user_suspension()
        suspension.suspend(reason, days, end_datetime)

    def lift_suspension(self):
        """제재 해제"""
        user_suspension = self.get_user_suspension()
        if user_suspension:
            user_suspension.lift()

    def get_or_create_ddok_point(self):
        """사용자의 DdokPoint 인스턴스를 가져오거나 생성합니다."""
        ddok_point, created = DdokPoint.objects.get_or_create(user=self)
        return ddok_point

    def calculate_trust_score(self):
        """매너 리뷰를 기반으로 신뢰덕 점수 계산 (100점 만점)"""
        from django.db import models
        
        reviews = MannerReview.objects.filter(target_user=self)
        
        if not reviews.exists():
            return 50  # 기본 점수 50점 (리뷰가 없는 경우)
        
        total_reviews = reviews.count()
        
        # 1. 별점 점수 (40점 만점) - 가장 중요한 지표
        avg_rating = reviews.aggregate(avg_rating=models.Avg('rating'))['avg_rating']
        rating_score = (avg_rating / 5.0) * 40 if avg_rating else 20
        
        # 2. 상품 상태 일치도 점수 (20점 만점)
        description_stats = reviews.values('description_match').annotate(count=models.Count('id'))
        description_score = 0
        for stat in description_stats:
            match_type = stat['description_match']
            count = stat['count']
            percentage = count / total_reviews
            
            if match_type == '동일':
                description_score += percentage * 20
            elif match_type == '미세 차이':
                description_score += percentage * 15
            elif match_type == '많이 다름':
                description_score += percentage * 5
        
        # 3. 응답 속도 점수 (15점 만점)
        response_stats = reviews.values('response_speed').annotate(count=models.Count('id'))
        response_score = 0
        for stat in response_stats:
            speed_type = stat['response_speed']
            count = stat['count']
            percentage = count / total_reviews
            
            if speed_type == '빠름':
                response_score += percentage * 15
            elif speed_type == '보통':
                response_score += percentage * 10
            elif speed_type == '느림':
                response_score += percentage * 5
            elif speed_type == '무응답':
                response_score += percentage * 0
        
        # 4. 메시지 매너 점수 (15점 만점)
        politeness_stats = reviews.values('politeness').annotate(count=models.Count('id'))
        politeness_score = 0
        for stat in politeness_stats:
            manner_type = stat['politeness']
            count = stat['count']
            percentage = count / total_reviews
            
            if manner_type == '친절':
                politeness_score += percentage * 15
            elif manner_type == '보통':
                politeness_score += percentage * 10
            elif manner_type == '불친절':
                politeness_score += percentage * 0
        
        # 5. 재거래 의사 점수 (10점 만점)
        deal_again_yes = reviews.filter(deal_again='O').count()
        deal_again_percentage = deal_again_yes / total_reviews if total_reviews > 0 else 0
        deal_again_score = deal_again_percentage * 10
        
        # 총점 계산 (100점 만점)
        total_score = rating_score + description_score + response_score + politeness_score + deal_again_score
        
        # 리뷰 개수 보정 (리뷰가 적으면 기본 점수로 수렴)
        if total_reviews < 5:
            # 리뷰가 적을 때는 기본 점수(50점)와 계산된 점수를 가중평균
            weight = total_reviews / 5.0  # 5개 이상일 때 100% 반영
            total_score = (total_score * weight) + (50 * (1 - weight))
        
        return round(total_score, 1)

    @property 
    def trust_score(self):
            """신뢰덕 점수 프로퍼티"""
            return self.calculate_trust_score()


class SocialAccount(models.Model):
    """소셜 로그인 계정 정보"""
    PROVIDER_CHOICES = [
        ('kakao', '카카오'),
        ('naver', '네이버'),
        ('google', '구글'),
    ]
    
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='social_account'
    )
    provider = models.CharField(
        max_length=20, 
        choices=PROVIDER_CHOICES,
        verbose_name="소셜 제공자"
    )
    social_id = models.CharField(
        max_length=100, 
        verbose_name="소셜 ID"
    )
    signup_completed = models.BooleanField(
        default=False, 
        verbose_name="소셜 가입 완료 여부"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['provider', 'social_id']
        verbose_name = '소셜 계정'
        verbose_name_plural = '소셜 계정 목록'
    
    @property
    def is_social_user(self):
        """소셜 로그인 사용자인지 확인"""
        return bool(self.social_id)
    
    def __str__(self):
        return f"{self.user.username}의 {self.get_provider_display()} 계정"


class UserSuspension(models.Model):
    """사용자 제재 정보"""
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='user_suspension'
    )
    suspension_start = models.DateTimeField(verbose_name="제재 시작일")
    suspension_end = models.DateTimeField(
        blank=True, 
        null=True, 
        verbose_name="제재 종료일"
    )
    suspension_reason = models.TextField(verbose_name="제재 사유")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = '사용자 제재'
        verbose_name_plural = '사용자 제재 목록'
    
    @property
    def is_suspended(self):
        """현재 제재 중인지 확인"""
        now = timezone.now()
        
        if self.suspension_start > now:
            return False
        
        if not self.suspension_end:
            return True
        
        return self.suspension_end > now

    @property
    def status_display(self):
        """제재 상태 문자열 반환"""
        if not self.is_suspended:
            return "정상"
        
        if not self.suspension_end:
            return "영구정지"
        
        remaining = self.suspension_end - timezone.now()
        
        if remaining.days > 0:
            return f"{remaining.days}일 {remaining.seconds // 3600}시간 남음"
        elif remaining.seconds > 3600:
            return f"{remaining.seconds // 3600}시간 {(remaining.seconds % 3600) // 60}분 남음"
        else:
            return f"{remaining.seconds // 60}분 남음"

    def suspend(self, reason, days=None, end_datetime=None):
        """제재 실행"""
        self.suspension_start = timezone.now()
        self.suspension_reason = reason
        
        if end_datetime:
            self.suspension_end = end_datetime
        elif days:
            self.suspension_end = timezone.now() + timezone.timedelta(days=days)
        else:
            self.suspension_end = None
        
        self.save()

    def lift(self):
        """제재 해제 - 객체 삭제"""
        self.delete()
    
    def __str__(self):
        status = "영구정지" if not self.suspension_end else f"{self.suspension_end.date()}까지"
        return f"{self.user.username} 제재 ({status})"


class FandomProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='fandom_profile')
    fandom_card = models.ImageField(upload_to=fandom_card_upload)
    fandom_artist = models.ForeignKey('artist.Artist', on_delete=models.CASCADE)

    # 인증 상태
    is_verified_fandom = models.BooleanField(default=False)
    is_pending_verification = models.BooleanField(default=False)
    verification_failed = models.BooleanField(default=False)

    # 사용자 입력 인증 기간
    verification_start_date = models.DateField(verbose_name="인증 시작일")
    verification_end_date = models.DateField(verbose_name="인증 만료일")

    # 기록
    applied_at = models.DateTimeField()
    verified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_verification_expired(self):
        """인증이 만료되었는지 확인"""
        return timezone.now().date() > self.verification_end_date
   
    @property
    def days_until_expiration(self):
        """만료까지 남은 일수"""
        today = timezone.now().date()
        if today > self.verification_end_date:
            return 0
        return (self.verification_end_date - today).days

    @property
    def needs_renewal_alert(self):
        """갱신 알림이 필요한지 확인 (7일 전)"""
        if not self.is_verified_fandom:
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
    _encrypted_bank_number = models.TextField()
    bank_holder = models.CharField(max_length=50)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def bank_number(self):
        return BankEncryption.decrypt(self._encrypted_bank_number)
    
    @bank_number.setter
    def bank_number(self, value):
        self._encrypted_bank_number = BankEncryption.encrypt(value)
    
    def get_masked_bank_number(self):
        """마스킹된 계좌번호 반환"""
        bank = self.bank_number
        if bank and len(bank) > 4:
            return '****' + bank[-4:]
        return '****'
    
    def __str__(self):
        return f"{self.user.username}의 계좌 ({self.bank_name})"


class AddressProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='address_profile')

    # 암호화 저장 필드들
    _encrypted_postal_code = models.TextField()
    _encrypted_road_address = models.TextField()
    _encrypted_detail_address = models.TextField()
    _encrypted_phone_number = models.TextField()

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
    def phone_number(self):
        return AddressEncryption.decrypt(self._encrypted_phone_number)
    
    @phone_number.setter
    def phone_number(self, value):
        self._encrypted_phone_number = AddressEncryption.encrypt(value)

    @property
    def full_address(self):
        """전체 주소 조합"""
        if self.detail_address:
            return f"{self.road_address}, {self.detail_address}"
        else:
            return self.road_address or ""

    def get_masked_address(self):
        """마스킹된 주소 (배송지 표시용)"""
        return f"{self.sido} {self.sigungu} ***"

    def get_masked_phone_number(self):
        """마스킹된 핸드폰 번호 반환"""
        phone = self.phone_number
        if phone and len(phone) >= 4:
            return phone[:3] + '****' + phone[-4:]
        return '010-****-****'

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


class PostReport(models.Model):
    """게시글 신고 모델 (덕담, 덕팜 공통)"""
    REPORT_REASONS = [
        ('profanity', '욕설, 불쾌한 표현 사용'),
        ('hate_spam', '혐오 발언, 반복적 광고, 선정적 내용'),
        ('illegal', '불법 콘텐츠, 범죄, 개인정보 노출'),
        ('irrelevant', '관련성이 낮은 게시글'),
    ]
    
    STATUS_CHOICES = [
        ('pending', '검토 중'),
        ('approved', '신고 승인'),
        ('rejected', '신고 반려'),
        ('resolved', '처리 완료'),
    ]
    
    # 신고 기본 정보
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='reports_made',
        verbose_name='신고자'
    )
    
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reports_received',
        verbose_name='신고 대상 유저'
    )
    
    # GenericForeignKey로 덕담, 덕팜 게시글 모두 지원
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    reason = models.CharField(
        max_length=20,
        choices=REPORT_REASONS,
        verbose_name='신고 사유'
    )
    
    additional_info = models.TextField(
        blank=True,
        verbose_name='추가 설명'
    )
    
    # 관리자 처리 정보
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='처리 상태'
    )
    
    admin_notes = models.TextField(
        blank=True,
        verbose_name='관리자 메모'
    )
    
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reports_processed',
        verbose_name='처리한 관리자'
    )
    
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='처리 일시'
    )
    
    # 제재 정보
    restriction_start = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='제재 시작일'
    )
    
    restriction_end = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='제재 종료일'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='신고 일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정 일시')
    
    class Meta:
        verbose_name = '게시글 신고'
        verbose_name_plural = '게시글 신고 목록'
        ordering = ['-created_at']
        unique_together = ['reporter', 'content_type', 'object_id']
    
    def __str__(self):
        return f"{self.reporter.username} → {self.get_reason_display()} ({self.get_status_display()})"
    
    def get_post_title(self):
        """신고된 게시글 제목 반환"""
        if self.content_object:
            return getattr(self.content_object, 'title', 'N/A')
        return 'N/A'
    
    def get_post_category(self):
        """신고된 게시글 카테고리 반환"""
        if self.content_object:
            return getattr(self.content_object, 'category_type', 'N/A')
        return 'N/A'
    
    def get_app_name(self):
        """신고된 게시글의 앱 이름 반환 (덕담/덕팜 구분)"""
        if self.content_object:
            model_name = self.content_type.model
            if model_name.startswith('dam'):
                return 'ddokdam'
            elif model_name.startswith('farm'):
                return 'ddokfarm'
        return 'unknown'
    
    def get_post_url(self):
        """신고된 게시글 URL 반환"""
        if self.content_object:
            app_name = self.get_app_name()
            category = self.get_post_category()
            try:
                from django.urls import reverse
                return reverse(f'{app_name}:post_detail', args=[category, self.object_id])
            except:
                return '#'
        return '#'


class DdokPoint(models.Model):
    """
    사용자의 '덕덕포인트 총합을 관리
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ddok_point',
        verbose_name='사용자'
    )
    total_points = models.PositiveIntegerField(
        default=0,
        verbose_name='쌓인 덕'
    )

    created_at = models.DateTimeField(     
        auto_now_add=True,
        verbose_name='생성 일시'
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='최근 변동 일시'
    )

    def __str__(self):
        return f"{self.user.username}의 덕 {self.total_points:,}덕"

    class Meta:
        verbose_name = '덕 포인트'
        verbose_name_plural = '덕 포인트 목록'


class DdokPointLog(models.Model):
    """
    '덕' 포인트의 모든 적립 및 사용 내역을 기록하는 로그 모델
    """
    POINT_REASON_CHOICES = [
        ('BIRTHDAY_GAME', '생일시 맞추기'),
        ('EVENT_PARTICIPATION', '이벤트 참여'),
        ('POST_REWARD', '게시글 작성 보상'),
        ('BANNER_REQUEST', '배너 신청'),
        ('BANNER_REFUND', '배너 신청 환불'),
    ]

    point_owner = models.ForeignKey(
        DdokPoint,
        on_delete=models.CASCADE,
        related_name='logs',
        verbose_name='포인트 소유자'
    )
    points_change = models.IntegerField(
        verbose_name='변동된 덕'
    )
    reason = models.CharField(
        max_length=50,
        choices=POINT_REASON_CHOICES,
        verbose_name='변동 사유'
    )
    related_member = models.ForeignKey(
        'artist.Member',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name='관련 멤버'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='기록 일시'
    )

    def __str__(self):
        change_type = "적립" if self.points_change > 0 else "사용"
        return f"[{self.get_reason_display()}] {self.point_owner.user.username}에게 {self.points_change:,}똑 {change_type}"

    class Meta:
        verbose_name = '덕 포인트 로그'
        verbose_name_plural = '덕덕 포인트 로그 목록'
        ordering = ['-created_at']


class BannerRequest(models.Model):
    """사용자 배너 신청 모델"""
    STATUS_CHOICES = [
        ('pending', '승인 대기'),
        ('approved', '승인됨'),
        ('rejected', '거절됨'),
        ('expired', '만료됨'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='banner_requests',
        verbose_name='신청자'
    )
    
    artist_name = models.CharField(
        max_length=100,
        verbose_name='아티스트명'
    )
    
    banner_image = models.ImageField(upload_to=banner_image_upload)
    
    ddok_points_used = models.PositiveIntegerField(
        default=1000,
        verbose_name='사용된 덕 포인트'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='상태'
    )
    
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='배너 시작일'
    )
    
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='배너 종료일'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='활성화 상태'
    )
    
    # 승인 관련
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_banners',
        verbose_name='승인자'
    )
    
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='승인 일시'
    )
    
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='만료 일시'
    )
    
    # 거절 사유
    rejection_reason = models.TextField(
        blank=True,
        verbose_name='거절 사유'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='신청 일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정 일시')
    
    class Meta:
        verbose_name = '배너 신청'
        verbose_name_plural = '배너 신청 목록'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.artist_name} ({self.get_status_display()})"
    
    @property
    def is_currently_active(self):
        """현재 활성화된 배너인지 확인 (날짜 기반)"""
        if self.status != 'approved' or not self.is_active:
            return False
        
        if not self.start_date or not self.end_date:
            return False
            
        from django.utils import timezone
        today = timezone.now().date()
        return self.start_date <= today <= self.end_date
    
    def approve(self, admin_user, start_date=None, end_date=None):
        """배너 승인 처리 - 설정값 사용"""
        from django.utils import timezone
        
        display_days = get_banner_display_days()  # 설정값 사용
        
        self.status = 'approved'
        self.approved_by = admin_user
        self.approved_at = timezone.now()
        self.expires_at = timezone.now() + timedelta(days=display_days)
        
        if start_date:
            self.start_date = start_date
        else:
            self.start_date = timezone.now().date()
            
        if end_date:
            self.end_date = end_date
        else:
            self.end_date = timezone.now().date() + timedelta(days=display_days)
            
        self.is_active = True
        self.save()
        return self
    
    def reject(self, admin_user, reason=""):
        """배너 거절 처리"""
        from django.utils import timezone
        
        self.status = 'rejected'
        self.approved_by = admin_user
        self.approved_at = timezone.now()
        self.rejection_reason = reason
        self.is_active = False
        self.save()
        return self