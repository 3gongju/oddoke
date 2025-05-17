from django.db import models
from django.conf import settings

class DdokdamPost(models.Model):
    CATEGORY_CHOICES = [
        ('community', '커뮤니티'),
        ('food', '예절샷'),
        ('cafe', '생일카페'),
    ]

    title = models.CharField(max_length=100)
    content = models.TextField()
    image = models.ImageField(upload_to='ddokdam/image', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='community')
    idol = models.CharField(max_length=200, blank=True, null=True)  # 해시태그 문자열 저장
    like_users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='like_ddokdam_posts', blank=True)

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title}"

class DdokdamComment(models.Model):
    content = models.CharField(max_length=200)
    post = models.ForeignKey(DdokdamPost, on_delete=models.CASCADE, related_name='ddokdamcomment')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.content
