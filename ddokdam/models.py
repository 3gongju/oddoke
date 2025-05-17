from django.db import models
from django_resized import ResizedImageField
from django.conf import settings

class Post(models.Model):
    # 게시글 카테고리 선택지
    CATEGORY_CHOICES = [
        ('community', '커뮤니티'),
        ('food', '예절샷'),
        ('cafe', '생일카페'),
    ]
    
    # 기본 필드
    title = models.CharField(max_length=100)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # 게시글 이미지
    image = ResizedImageField(
        size=[1080, 1080],
        crop=['middle', 'center'],
        upload_to='ddokdam/image',
        blank=True,
        null=True
    )
    
    # 작성자 (User 모델 참조)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    # 카테고리 필드
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='community')
    
    # 아이돌 태그 (선택적)
    idol = models.CharField(max_length=50, blank=True, null=True)
    
    # 예절샷 카테고리 필드
    location = models.CharField(max_length=100, blank=True, null=True)  # 식당/카페 위치
    doll = models.CharField(max_length=50, blank=True, null=True)  # 사용된 인형
    
    # 생일카페 카테고리 필드
    cafe_name = models.CharField(max_length=100, blank=True, null=True)  # 카페 이름
    cafe_location = models.CharField(max_length=200, blank=True, null=True)  # 카페 위치
    start_date = models.DateField(blank=True, null=True)  # 시작 날짜
    end_date = models.DateField(blank=True, null=True)  # 종료 날짜
    
    # 좋아요 기능 (User 모델과 M:N 관계)
    like_users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='like_ddokdam_posts', blank=True)
    
    def __str__(self):
        return f'[{self.get_category_display()}] {self.title}'

class Comment(models.Model):
    content = models.CharField(max_length=200)
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.content