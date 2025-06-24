# accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django_resized import ResizedImageField
from django.utils import timezone
from datetime import timedelta
from .utils import AccountEncryption, AddressEncryption
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation 

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
   
    # 🔥 소셜 로그인 ID 저장 필드 추가
    kakao_id = models.CharField(max_length=50, blank=True, null=True, verbose_name="카카오 ID")
    naver_id = models.CharField(max_length=50, blank=True, null=True, verbose_name="네이버 ID")

    # 🔥 제재 관련 필드 추가
    suspension_start = models.DateTimeField(blank=True, null=True, verbose_name="제재 시작일")
    suspension_end = models.DateTimeField(blank=True, null=True, verbose_name="제재 종료일")
    suspension_reason = models.TextField(blank=True, null=True, verbose_name="제재 사유")

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
        """화면에 표시할 이름 반환"""
        # 🔥 1순위: first_name이 있으면 우선 사용 (프로필 관리에서 변경한 닉네임)
        if self.first_name and self.first_name.strip():
            return self.first_name
        
        # 🔥 2순위: 소셜 가입이 완료되고 임시 사용자명이 아닌 경우 username 사용
        if self.social_signup_completed and not self.is_temp_username:
            return self.username
        
        # 🔥 3순위: 임시 사용자명인 경우 (아직 프로필 완성하지 않은 경우)
        if self.is_temp_username:
            if self.username.startswith('temp_kakao_'):
                return "카카오 사용자"
            elif self.username.startswith('temp_naver_'):
                return "네이버 사용자"
            else:
                return "새로운 사용자"
        
        # 🔥 4순위: 기본적으로 username 반환
        return self.username
   
    @property
    def is_social_user(self):
        return self.username.startswith(('temp_kakao_', 'temp_naver_'))

    @property
    def is_suspended(self):
        """현재 제재 중인지 확인"""
        if not self.suspension_start:
            return False
        
        from django.utils import timezone
        now = timezone.now()
        
        # 제재 시작일이 현재보다 미래면 아직 제재 아님
        if self.suspension_start > now:
            return False
        
        # 제재 종료일이 없으면 영구정지
        if not self.suspension_end:
            return True
        
        # 제재 종료일이 현재보다 미래면 제재 중
        return self.suspension_end > now

    @property
    def suspension_status(self):
        """제재 상태 문자열 반환"""
        if not self.is_suspended:
            return "정상"
        
        if not self.suspension_end:
            return "영구정지"
        
        from django.utils import timezone
        remaining = self.suspension_end - timezone.now()
        
        if remaining.days > 0:
            return f"{remaining.days}일 {remaining.seconds // 3600}시간 남음"
        elif remaining.seconds > 3600:
            return f"{remaining.seconds // 3600}시간 {(remaining.seconds % 3600) // 60}분 남음"
        else:
            return f"{remaining.seconds // 60}분 남음"

    def suspend_user(self, reason, days=None, end_datetime=None):
        """사용자 제재"""
        from django.utils import timezone
        
        self.suspension_start = timezone.now()
        self.suspension_reason = reason
        
        if end_datetime:
            self.suspension_end = end_datetime
        elif days:
            self.suspension_end = timezone.now() + timezone.timedelta(days=days)
        else:
            self.suspension_end = None  # 영구정지
        
        self.save(update_fields=['suspension_start', 'suspension_end', 'suspension_reason'])

    def lift_suspension(self):
        """제재 해제"""
        self.suspension_start = None
        self.suspension_end = None
        self.suspension_reason = None
        self.save(update_fields=['suspension_start', 'suspension_end', 'suspension_reason'])

    def get_or_create_ddok_point(self):
        """사용자의 DdokPoint 인스턴스를 가져오거나 생성합니다."""
        ddok_point, created = DdokPoint.objects.get_or_create(user=self)
        return ddok_point


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
    _encrypted_road_address = models.TextField(blank=True, null=True)
    _encrypted_detail_address = models.TextField(blank=True, null=True)
    _encrypted_phone_number = models.TextField(blank=True, null=True)

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
        ('irrelevant', '관련성이 낮은 게시글'),  # 🔥 새로운 신고 사유 추가
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
        ('BANNER_REQUEST', '배너 신청'),  # 새로 추가
        ('BANNER_REFUND', '배너 신청 환불'),  # 새로 추가
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
    
    banner_image = models.ImageField(
        upload_to='user_banners/',
        verbose_name='배너 이미지'
    )
    
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
    
    # 🔥 새로 추가할 필드들
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
    
    # 승인 관련 (기존 필드들...)
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
        """배너 승인 처리"""
        from django.utils import timezone
        from datetime import timedelta
        
        self.status = 'approved'
        self.approved_by = admin_user
        self.approved_at = timezone.now()
        self.expires_at = timezone.now() + timedelta(days=3)  # 기존 로직 유지
        
        # 🔥 새로운 날짜 필드 설정
        if start_date:
            self.start_date = start_date
        else:
            self.start_date = timezone.now().date()
            
        if end_date:
            self.end_date = end_date
        else:
            self.end_date = timezone.now().date() + timedelta(days=3)
            
        self.is_active = True
        self.save()
    
    def reject(self, admin_user, reason=""):
        """배너 거절 처리"""
        from django.utils import timezone
        
        self.status = 'rejected'
        self.approved_by = admin_user
        self.approved_at = timezone.now()
        self.rejection_reason = reason
        self.is_active = False
        self.save()
        
        # 덕 포인트 환불
        self.refund_points()
    
    def refund_points(self):
        """덕 포인트 환불"""
        from accounts.point_utils import add_ddok_points
        
        add_ddok_points(
            user=self.user,
            points=self.ddok_points_used,
            reason='BANNER_REFUND',
            related_member=None
        )