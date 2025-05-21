from django.db import models
from django.conf import settings

class DamPost(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    image = models.ImageField(upload_to='ddokdam/image')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    # artist 모델과 연결 필요

    class Meta:
        abstract = True

class DamCommunityPost(DamPost):
    pass    

class DamMannerPost(DamPost):
    location = models.CharField(max_length=255, blank=True, null=True)
    item = models.CharField(max_length=255, blank=True, null=True)

class DamBdaycafePost(DamPost):
    cafe_name = models.CharField(max_length=255, blank=True, null=True)
    cafe_location = models.CharField(max_length=255, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)

class DamComment(models.Model):
    content = models.CharField(max_length=200)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')  # ✅ 대댓글
    created_at = models.DateTimeField(auto_now_add=True)

    community_post = models.ForeignKey(DamCommunityPost, on_delete=models.CASCADE)
    manner_post = models.ForeignKey(DamMannerPost, on_delete=models.CASCADE)
    bdaycafe_post = models.ForeignKey(DamBdaycafePost, on_delete=models.CASCADE)
