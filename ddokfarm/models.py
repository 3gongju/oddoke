from django.db import models
from django.conf import settings
from artist.models import Artist, Member

class FarmBasePost(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    image = models.ImageField(upload_to='ddokfarm/image')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    like = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="liked_%(class)s", blank=True)
    is_sold = models.BooleanField(default=False) # 판매 완료 여부
    artist = models.ForeignKey(Artist, on_delete=models.SET_NULL, null=True, blank=True)
    members = models.ManyToManyField(Member, blank=True)

    class Meta:
        abstract = True

class FarmMarketPost(FarmBasePost):
    # 상품 상태 선택지
    CONDITION_CHOICES = [
        ('new', '미개봉'),
        ('almost_new', '거의 새것'),
        ('used', '사용감 있음'),
        ('damaged', '하자 있음'),
    ]

    # 배송 방법 선택지
    SHIPPING_CHOICES = [
        ('delivery', '택배'),
        ('direct', '직거래'),
        ('both', '직거래, 택배'),
    ]

    price = models.PositiveIntegerField() # 가격
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES) # 상태
    shipping = models.CharField(max_length=20, choices=SHIPPING_CHOICES)  # 배송방법
    location = models.CharField(max_length=20, blank=True, null=True)  # 희망 장소 (직거래 가능 시)

    class Meta:
        abstract = True

class FarmSellPost(FarmMarketPost):
    WANTTO_CHOICES = [
        ('sell', '팝니다'),
        ('buy', '삽니다'),
        ('exchange', '교환해요'),
    ]

    want_to = models.CharField(max_length=20, choices=WANTTO_CHOICES)
    
    @property
    def category_type(self):
        return 'sell'

class FarmRentalPost(FarmMarketPost):
    WANTTO_CHOICES = [
        ('sell', '빌려줍니다'),
        ('buy', '빌려주세요'),
    ]

    want_to = models.CharField(max_length=20, choices=WANTTO_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    
    @property
    def category_type(self):
        return 'rental'



class FarmSplitPost(FarmBasePost):
    ALBUM_CHOICES = [
        ('include', '포함'),
        ('not_include', '미포함'),
    ]

    OPENED_CHOICES = [
        ('opende', '개봉'),
        ('unopened', '미개봉'),
    ]

    FAILURE_CHOICES = [
        ('failure', '무산'),
        ('not_failure', '무산없음'),
        ('split', 'N빵'),
    ]

    album = models.CharField(max_length=20, choices=ALBUM_CHOICES)
    opened = models.CharField(max_length=20, choices=OPENED_CHOICES)
    shipping_fee = models.PositiveIntegerField()
    where = models.CharField(max_length=100)
    when = models.DateField()
    failure = models.CharField(max_length=20, choices=FAILURE_CHOICES)
    # 멤버별 가격 설정 필드 연결 필요

    @property
    def category_type(self):
        return 'split'
        
# 대댓글 기능 수정 
class FarmComment(models.Model):
    content = models.CharField(max_length=200)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')  # ✅ 대댓글
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    sell_post = models.ForeignKey(FarmSellPost, on_delete=models.CASCADE, null=True, blank=True)
    rental_post = models.ForeignKey(FarmRentalPost, on_delete=models.CASCADE, null=True, blank=True)
    split_post = models.ForeignKey(FarmSplitPost, on_delete=models.CASCADE, null=True, blank=True)