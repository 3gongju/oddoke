from django.db import models
from django.conf import settings


class DdokdamPost(models.Model):
    CATEGORY_CHOICES = [
        ('community', '덕담 한마디'),
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
    idol = models.CharField(max_length=200, blank=True, null=True)  # 아이돌 정보
    hashtags = models.CharField(max_length=200, blank=True, null=True)  # 해시태그
    location = models.CharField(max_length=255, blank=True, null=True)  # 위치
    cafe_name = models.CharField(max_length=255, blank=True, null=True)  # 카페 이름
    cafe_location = models.CharField(max_length=255, blank=True, null=True)  # 카페 위치
    start_date = models.DateField(blank=True, null=True)  # 시작 날짜
    end_date = models.DateField(blank=True, null=True)  # 종료 날짜


class DdokdamComment(models.Model):
    content = models.CharField(max_length=200)
    post = models.ForeignKey(DdokdamPost, on_delete=models.CASCADE, related_name='ddokdamcomment')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.content
