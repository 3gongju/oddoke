from django.db import models
from django_resized import ResizedImageField
from django.conf import settings
from django.utils.text import slugify

# 카테고리 모델
class Category(models.Model):
    name = models.CharField(max_length=20)
    slug = models.SlugField(max_length=50, unique=True)  # URL 노출용: junggogeorae 등

    def __str__(self):
        return self.name

# 상품 모델 (기존 Post 모델 확장)
class Post(models.Model):
    # 상품 상태 선택지
    CONDITION_CHOICES = [
        ('new', '새상품'),
        ('almost_new', '거의 새것'),
        ('used', '중고'),
        ('damaged', '손상있음'),
    ]
    
    # 교환 여부 선택지
    EXCHANGE_CHOICES = [
        ('possible', '교환가능'),
        ('impossible', '교환불가'),
    ]
    
    # 직거래 여부 선택지
    DIRECT_DEAL_CHOICES = [
        ('possible', '가능'),
        ('impossible', '불가능'),
    ]
    
    # 배송 방법 선택지
    SHIPPING_CHOICES = [
        ('direct', '직거래'),
        ('delivery', '택배'),
        ('both', '직거래, 택배'),
    ]
    
    # 기존 필드
    title = models.CharField(max_length=100)  # 제목
    content = models.TextField()  # 내용
    created_at = models.DateTimeField(auto_now_add=True)  # 작성일
    updated_at = models.DateTimeField(auto_now=True)  # 수정일
    
    # 대표 이미지
    image = ResizedImageField(
        size=[500, 500],
        crop=['middle', 'center'],
        upload_to='image'
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # 작성자

    # 찜하기 다대다 

    liked_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='liked_posts',
        blank=True
    )

    
    # 이커머스 필드
    price = models.IntegerField(default=0)  # 가격
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)  # 카테고리
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='new')  # 상태
    exchange = models.CharField(max_length=20, choices=EXCHANGE_CHOICES, default='impossible')  # 교환여부
    direct_deal = models.CharField(max_length=20, choices=DIRECT_DEAL_CHOICES, default='impossible')  # 직거래 여부
    preferred_location = models.CharField(max_length=100, blank=True, null=True)  # 희망 장소 (직거래 가능 시)
    shipping = models.CharField(max_length=20, choices=SHIPPING_CHOICES, default='both')  # 배송방법
    is_sold = models.BooleanField(default=False)  # 판매 완료 여부
    
    def __str__(self):
        return self.title

# 대댓글 기능 수정 
class Comment(models.Model):
    content = models.CharField(max_length=200)
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')  # ✅ 대댓글
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return self.content

    def is_reply(self):
        return self.parent is not None
