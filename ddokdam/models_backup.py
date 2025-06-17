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
    images = GenericRelation('ddokdam.DamPostImage')  # 역참조용

    @property
    def category_type(self):
        return 'bdaycafe'
        
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