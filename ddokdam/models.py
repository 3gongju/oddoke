from django.db import models
from django.conf import settings
from artist.models import Artist, Member

class DamBasePost(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    image = models.ImageField(upload_to='ddokdam/image')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    like = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="liked_%(class)s", blank=True)
    artist = models.ForeignKey(Artist, on_delete=models.SET_NULL, null=True, blank=True)
    members = models.ManyToManyField(Member, blank=True)

    class Meta:
        abstract = True

class DamCommunityPost(DamBasePost):
    pass

    @property
    def category_type(self):
        return 'community'

class DamMannerPost(DamBasePost):
    location = models.CharField(max_length=255, blank=True, null=True)
    item = models.CharField(max_length=255, blank=True, null=True)

    @property
    def category_type(self):
        return 'manner'

class DamBdaycafePost(DamBasePost):
    cafe_name = models.CharField(max_length=255, blank=True, null=True)

    @property
    def category_type(self):
        return 'bdaycafe'
        
class DamComment(models.Model):
    content = models.CharField(max_length=200)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')  # ✅ 대댓글
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    community_post = models.ForeignKey(DamCommunityPost, on_delete=models.CASCADE, null=True, blank=True)
    manner_post = models.ForeignKey(DamMannerPost, on_delete=models.CASCADE, null=True, blank=True)
    bdaycafe_post = models.ForeignKey(DamBdaycafePost, on_delete=models.CASCADE, null=True, blank=True)
