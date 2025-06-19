from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation 
from django.contrib.contenttypes.models import ContentType
from artist.models import Artist, Member

class DamBasePost(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField() 
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    like = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="liked_%(class)s", blank=True)
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE)
    members = models.ManyToManyField(Member, blank=True)
    view_count = models.PositiveIntegerField(default=0)

    class Meta:
        abstract = True

class DamCommunityPost(DamBasePost):
    images = GenericRelation('ddokdam.DamPostImage')  # 역참조용

    @property
    def category_type(self):
        return 'community'

class DamMannerPost(DamBasePost):
    location = models.CharField(max_length=255, blank=True, null=True)
    item = models.CharField(max_length=255, blank=True, null=True)
    images = GenericRelation('ddokdam.DamPostImage')  # 역참조용

    @property
    def category_type(self):
        return 'manner'

class DamBdaycafePost(DamBasePost):
    cafe_name = models.CharField(max_length=255, blank=True, null=True)
    
    # 덕생 카페 연결 필드 추가 (새로운 필드)
    linked_ddoksang_cafe_id = models.PositiveIntegerField(
        null=True, 
        blank=True,
        verbose_name='연결된 덕생 카페 ID',
        help_text='덕생에 등록된 카페의 ID (수동 입력 방지를 위해 별도 관리)'
    )
    
    images = GenericRelation('ddokdam.DamPostImage')  # 기존 유지

    @property
    def category_type(self):
        return 'bdaycafe'
    
    def get_linked_cafe_info(self):
        """연결된 덕생 카페 정보 반환 (외부 참조 방식)"""
        if not self.linked_ddoksang_cafe_id:
            return None
            
        try:
            # 동적 import로 순환 참조 방지
            from ddoksang.models import BdayCafe
            cafe = BdayCafe.objects.select_related('artist', 'member').get(
                id=self.linked_ddoksang_cafe_id,
                status='approved'
            )
            
            return {
                'id': cafe.id,
                'name': cafe.cafe_name,
                'artist': cafe.artist.display_name if cafe.artist else '',
                'member': cafe.member.member_name if cafe.member else '',
                'address': cafe.address,
                'place_name': cafe.place_name,
                'detail_url': f'/ddoksang/cafe/{cafe.id}/',
                'main_image': cafe.get_main_image() if hasattr(cafe, 'get_main_image') else None,
                'is_active': cafe.is_active if hasattr(cafe, 'is_active') else False,
            }
        except ImportError:
            # ddoksang 앱이 없는 경우
            return None
        except Exception:
            # 카페가 삭제되었거나 접근할 수 없는 경우
            return None
        
class DamComment(models.Model):
    content = models.CharField(max_length=200)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')   # ✅ 대댓글
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False) # 삭제된 댓글 추가

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    post = GenericForeignKey('content_type', 'object_id')

# 이미지 여러장
class DamPostImage(models.Model):
    image = models.ImageField(upload_to='ddokdam/image')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    is_representative = models.BooleanField(default=False)


class DamPostReport(models.Model):
    REPORT_REASONS = [
        ('profanity', '욕설, 불쾌한 표현 사용'),
        ('hate_spam', '혐오 발언, 반복적 광고, 선정적 내용'),
        ('illegal', '불법 콘텐츠, 범죄, 개인정보 노출'),
    ]
    
    STATUS_CHOICES = [
        ('pending', '검토 중'),
        ('approved', '신고 승인'),
        ('rejected', '신고 반려'),
        ('resolved', '처리 완료'),
    ]
    
    VIOLATION_LEVELS = [
        ('minor', '경미한 위반'),
        ('moderate', '중간 수준의 위반'),
        ('severe', '심각한 위반'),
    ]
    
    # 신고 기본 정보
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='dam_reports_made',
        verbose_name='신고자'
    )
    
    # 신고 대상 게시글 (Generic Foreign Key)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    reported_post = GenericForeignKey('content_type', 'object_id')
    
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='dam_reports_received',
        verbose_name='신고 대상 유저'
    )
    
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
    
    violation_level = models.CharField(
        max_length=20,
        choices=VIOLATION_LEVELS,
        blank=True,
        null=True,
        verbose_name='위반 수준'
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
        related_name='dam_reports_processed',
        verbose_name='처리한 관리자'
    )
    
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='처리 일시'
    )
    
    # 제재 정보
    action_taken = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='취한 조치'
    )
    
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
        verbose_name = '덕담 게시글 신고'
        verbose_name_plural = '덕담 게시글 신고 목록'
        ordering = ['-created_at']
        
        # 같은 유저가 같은 게시글을 중복 신고하는 것 방지
        unique_together = ['reporter', 'content_type', 'object_id']
    
    def __str__(self):
        return f"{self.reporter.username} → {self.get_reason_display()} ({self.get_status_display()})"
    
    def get_post_title(self):
        """신고된 게시글 제목 반환"""
        if self.reported_post:
            return getattr(self.reported_post, 'title', 'N/A')
        return 'N/A'
    
    def get_post_category(self):
        """신고된 게시글 카테고리 반환"""
        if self.reported_post:
            return getattr(self.reported_post, 'category_type', 'N/A')
        return 'N/A'
    
    def get_post_url(self):
        """신고된 게시글 URL 반환"""
        if self.reported_post:
            category = self.get_post_category()
            try:
                from django.urls import reverse
                return reverse('ddokdam:post_detail', args=[category, self.object_id])
            except:
                return '#'
        return '#'


# User 모델에 제재 관련 필드 추가 (User 모델을 확장하는 방법)
class UserRestriction(models.Model):
    """유저 제재 정보"""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='restriction_info'
    )
    
    is_restricted = models.BooleanField(default=False, verbose_name='제재 여부')
    restriction_start = models.DateTimeField(null=True, blank=True, verbose_name='제재 시작일')
    restriction_end = models.DateTimeField(null=True, blank=True, verbose_name='제재 종료일')
    restriction_reason = models.TextField(blank=True, verbose_name='제재 사유')
    warning_count = models.PositiveIntegerField(default=0, verbose_name='경고 횟수')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = '유저 제재 정보'
        verbose_name_plural = '유저 제재 정보'
    
    def __str__(self):
        return f"{self.user.username} - {'제재중' if self.is_restricted else '정상'}"
    
    def is_currently_restricted(self):
        """현재 제재 중인지 확인"""
        if not self.is_restricted:
            return False
        
        if self.restriction_end:
            from django.utils import timezone
            return timezone.now() < self.restriction_end
        
        return True  # 영구 제재