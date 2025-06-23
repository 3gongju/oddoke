from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation 
from django.contrib.contenttypes.models import ContentType
from artist.models import Artist, Member

# 배송 방법 선택지
SHIPPING_METHOD_CHOICES = [
    ('post_parcel', '우체국 택배'),       # 우체국 소포
    ('post_semi_reg', '준등기'),          # 우체국 준등기  
    ('gs_delivery', '반택'),              # GS25 편의점택배
    ('cu_delivery', '끼택'),              # CU 편의점택배
    ('etc', '기타'),                      # 기타 방법
]

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
    
    # 배송 관련 필드 추가
    shipping_methods = models.CharField(
        max_length=200,
        blank=True,
        help_text="선택된 배송 방법들 (콤마로 구분)"
    )
    shipping_fee = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text="배송비 (원)"
    )

    class Meta:
        abstract = True
    
    def get_shipping_methods_list(self):
        """선택된 배송 방법들을 리스트로 반환"""
        if not self.shipping_methods:
            return []
        return [method.strip() for method in self.shipping_methods.split(',') if method.strip()]
    
    def get_shipping_methods_display(self):
        """선택된 배송 방법들을 문자열로 반환"""
        if not self.shipping_methods:
            return "배송 방법 미정"
        
        methods = self.get_shipping_methods_list()
        method_dict = dict(SHIPPING_METHOD_CHOICES)
        display_names = [method_dict.get(method, method) for method in methods]
        return ', '.join(display_names)
    
    def has_shipping_method(self, method):
        """특정 배송 방법이 선택되었는지 확인"""
        return method in self.get_shipping_methods_list()

class ItemPrice(models.Model):
    """개별 물건 가격 정보 (양도/대여 공통)"""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    post = GenericForeignKey('content_type', 'object_id')
    
    item_name = models.CharField(max_length=20, blank=True, help_text="물건명 (비어있으면 '덕N'으로 자동 표시)")
    price = models.PositiveIntegerField(help_text="개별 물건 가격")
    is_price_undetermined = models.BooleanField(
        default=False, 
        help_text="가격 미정 여부"
    )  # 새로 추가되는 필드
    is_sold = models.BooleanField(default=False, help_text="개별 판매 완료 여부 (향후 기능)")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['id']
        
    def __str__(self):
        if self.is_price_undetermined:
            display_name = self.item_name or f"덕{self.get_display_number()}"
            return f"{self.post.title} - {display_name} (가격 미정)"
        else:
            display_name = self.item_name or f"덕{self.get_display_number()}"
            return f"{self.post.title} - {display_name} ({self.price:,}원)"
    
    def get_display_number(self):
        """덕1, 덕2... 표시용 번호 반환"""
        same_post_items = ItemPrice.objects.filter(
            content_type=self.content_type, 
            object_id=self.object_id
        ).order_by('id')
        return list(same_post_items).index(self) + 1
    
    def get_display_name(self):
        """표시용 이름 반환 (물건명이 있으면 물건명, 없으면 '덕N')"""
        return self.item_name or f"덕{self.get_display_number()}"
    
    def get_display_price(self):
        """표시용 가격 문자열"""
        if self.is_price_undetermined:
            return "가격 미정"
        return f"{self.price:,}원"

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

    # price 필드 제거됨 - 모든 가격은 ItemPrice로 관리
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES) # 상태
    shipping = models.CharField(max_length=20, choices=SHIPPING_CHOICES)  # 배송방법
    location = models.CharField(max_length=20, blank=True, null=True)  # 희망 장소 (직거래 가능 시)
    members = models.ManyToManyField(Member, blank=True)

    class Meta:
        abstract = True
    
    def get_item_prices(self):
        """현재 게시글의 개별 가격 목록"""
        content_type = ContentType.objects.get_for_model(self.__class__)
        return ItemPrice.objects.filter(content_type=content_type, object_id=self.id)
    
    def has_multiple_items(self):
        """여러 물건이 있는지 확인"""
        return self.get_item_prices().count() > 1
    
    def get_price_range(self):
        """가격 범위 반환"""
        prices = list(self.get_item_prices().values_list('price', flat=True))
        if not prices:
            return (0, 0)
        return (min(prices), max(prices))
    
    def get_display_price(self):
        """표시용 가격 문자열"""
        min_price, max_price = self.get_price_range()
        if min_price == 0 and max_price == 0:
            return "가격 미정"
        if min_price == max_price:
            return f"{min_price:,}원"
        return f"{min_price:,}원 ~ {max_price:,}원"
    
    @property
    def effective_price(self):
        """정렬용 가격 (최소값)"""
        min_price, _ = self.get_price_range()
        return min_price

    @property 
    def price(self):
        """하위 호환성을 위한 price 프로퍼티 (정렬 등에서 사용)"""
        return self.effective_price

class ExchangeItem(models.Model):
    """교환 정보 (양도 게시글용)"""
    post = models.OneToOneField(
        'FarmSellPost', 
        on_delete=models.CASCADE, 
        related_name='exchange_info'
    )
    give_description = models.CharField(
        max_length=50,
        help_text="내가 주는 것",
        verbose_name="주는 것"
    )
    want_description = models.CharField(
        max_length=50,
        help_text="내가 받고 싶은 것", 
        verbose_name="받고 싶은 것"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['id']
        verbose_name = "교환 정보"
        verbose_name_plural = "교환 정보"
        
    def __str__(self):
        return f"{self.post.title} - 교환 정보"

class FarmSellPost(FarmMarketPost):
    WANTTO_CHOICES = [
        ('sell', '팝니다'),
        ('buy', '삽니다'),
        ('exchange', '교환해요'),
    ]

    # 굿즈 종류 선택지
    MD_CHOICES = [
        ('poca', '포토카드'),
        ('md', 'MD'),
        ('light_stick', '응원봉'),
        ('album', '앨범'),
        ('etc', '기타'),
    ]

    want_to = models.CharField(max_length=20, choices=WANTTO_CHOICES)
    md = models.CharField(max_length=20, choices=MD_CHOICES) # 굿즈 종류
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
    # shipping_fee = models.PositiveIntegerField()
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

    @property
    def price(self):
        """정렬을 위해 분철 게시글의 최소 가격 반환"""
        prices = self.member_prices.values_list('price', flat=True)
        return min(prices) if prices else 0

    def get_price_range(self):
        """분철 게시글의 가격 범위 반환 (튜플 형태로 개선)"""
        prices = list(self.member_prices.values_list('price', flat=True))
        if not prices:
            return (0, 0)
        return (min(prices), max(prices))

    def has_price_in_range(self, min_price=None, max_price=None):
        """분철 게시글이 지정된 가격 범위에 포함되는지 확인"""
        prices = list(self.member_prices.values_list('price', flat=True))
        if not prices:
            return False
        
        min_post_price = min(prices)
        max_post_price = max(prices)
        
        if min_price and max_post_price < min_price:
            return False
        if max_price and min_post_price > max_price:
            return False
        
        return True
    
    def get_display_price(self):
        """표시용 가격 문자열 (판매/대여와 통일)"""
        min_price, max_price = self.get_price_range()
        if min_price == max_price:
            return f"{min_price:,}원"
        return f"{min_price:,}원 ~ {max_price:,}원"

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
        
# 대댓글 기능
class FarmComment(models.Model):
    content = models.CharField(max_length=200)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')  # ✅ 대댓글
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)  # 삭제된 댓글 

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