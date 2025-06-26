from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation 
from django.contrib.contenttypes.models import ContentType
from artist.models import Artist, Member
from upload_utils import ddokdam_image_upload

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

    def get_main_image(self):
        """대표 이미지 URL 반환"""
        main_img = self.images.filter(is_representative=True).first()
        if main_img:
            return main_img.image.url
        return None

class DamMannerPost(DamBasePost):
    location = models.CharField(max_length=255, blank=True, null=True)
    item = models.CharField(max_length=255, blank=True, null=True)
    images = GenericRelation('ddokdam.DamPostImage')  # 역참조용

    @property
    def category_type(self):
        return 'manner'

    def get_main_image(self):
        """대표 이미지 URL 반환"""
        main_img = self.images.filter(is_representative=True).first()
        if main_img:
            return main_img.image.url
        return None

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
    
    def get_main_image(self):
        """대표 이미지 URL 반환"""
        main_img = self.images.filter(is_representative=True).first()
        if main_img:
            return main_img.image.url
        return None
    
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
    image = models.ImageField(upload_to=ddokdam_image_upload)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    is_representative = models.BooleanField(default=False)


