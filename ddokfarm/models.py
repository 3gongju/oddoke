from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation 
from django.contrib.contenttypes.models import ContentType
from artist.models import Artist, Member

class FarmBasePost(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    like = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="liked_%(class)s", blank=True)
    is_sold = models.BooleanField(default=False) # 판매 완료 여부
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE)
    view_count = models.PositiveIntegerField(default=0)

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

    # 굿즈 종류 선택지
    MD_CHOICES = [
        ('poca', '포토카드'),
        ('md', 'MD'),
        ('light_stick', '응원봉'),
        ('album', '앨범'),
        ('etc', '기타'),
    ]

    price = models.PositiveIntegerField() # 가격
    md = models.CharField(max_length=20, choices=MD_CHOICES) # 굿즈 종류
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES) # 상태
    shipping = models.CharField(max_length=20, choices=SHIPPING_CHOICES)  # 배송방법
    location = models.CharField(max_length=20, blank=True, null=True)  # 희망 장소 (직거래 가능 시)
    members = models.ManyToManyField(Member, blank=True)

    class Meta:
        abstract = True

class FarmSellPost(FarmMarketPost):
    WANTTO_CHOICES = [
        ('sell', '팝니다'),
        ('buy', '삽니다'),
        ('exchange', '교환해요'),
    ]

    want_to = models.CharField(max_length=20, choices=WANTTO_CHOICES)
    images = GenericRelation('ddokfarm.FarmPostImage')  # 역참조용
    
    @property
    def category_type(self):
        return 'sell'

    def get_main_image(self):
        main_img = self.images.filter(is_representative=True).first()
        if main_img:
            return main_img.image.url
        return None

class FarmRentalPost(FarmMarketPost):
    WANTTO_CHOICES = [
        ('sell', '빌려줍니다'),
        ('buy', '빌려주세요'),
    ]

    want_to = models.CharField(max_length=20, choices=WANTTO_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    images = GenericRelation('ddokfarm.FarmPostImage')  # 역참조용
    
    @property
    def category_type(self):
        return 'rental'

    def get_main_image(self):
        main_img = self.images.filter(is_representative=True).first()
        if main_img:
            return main_img.image.url
        return None

class FarmSplitPost(FarmBasePost):
    ALBUM_CHOICES = [
        ('include', '포함'),
        ('not_include', '미포함'),
    ]

    FAILURE_CHOICES = [
        ('failure', '무산'),
        ('not_failure', '무산없음'),
        ('split', 'N빵'),
    ]

    PUSH_CHOICES = [
        ('yes', '가능'),
        ('no', '불가능'),
    ]

    album = models.CharField(max_length=20, choices=ALBUM_CHOICES)
    shipping_fee = models.PositiveIntegerField()
    where = models.CharField(max_length=100)
    when = models.DateField()
    failure = models.CharField(max_length=20, choices=FAILURE_CHOICES)
    images = GenericRelation('ddokfarm.FarmPostImage')  # 역참조용
    checked_out_members = models.ManyToManyField(Member, blank=True, related_name="checked_out_split_posts")
    push = models.CharField(max_length=20, choices=PUSH_CHOICES)

    @property
    def category_type(self):
        return 'split'

    def get_main_image(self):
        main_img = self.images.filter(is_representative=True).first()
        if main_img:
            return main_img.image.url
        return None

# 멤버별 가격 설정 필드
class SplitPrice(models.Model):
    post = models.ForeignKey(FarmSplitPost, on_delete=models.CASCADE, related_name='member_prices')
    member = models.ForeignKey(Member, on_delete=models.CASCADE)
    price = models.PositiveIntegerField()

    class Meta:
        unique_together = ('post', 'member')

# 분철 참여 관리
class SplitApplication(models.Model):
    STATUS_CHOICES = [
        ('pending', '대기중'),
        ('approved', '승인됨'),
        ('rejected', '반려됨'),
    ]
    
    post = models.ForeignKey(FarmSplitPost, on_delete=models.CASCADE, related_name='applications')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    members = models.ManyToManyField(Member)  # 신청한 멤버들
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
        
# 대댓글 기능 수정 
class FarmComment(models.Model):
    content = models.CharField(max_length=200)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')  # ✅ 대댓글
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    post = GenericForeignKey('content_type', 'object_id')

# 이미지 여러장
class FarmPostImage(models.Model):
    image = models.ImageField(upload_to='ddokfarm/image')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    is_representative = models.BooleanField(default=False)