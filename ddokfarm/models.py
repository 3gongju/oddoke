from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation 
from django.contrib.contenttypes.models import ContentType
from artist.models import Artist, Member
import os
from datetime import datetime
from collections import namedtuple

PriceRange = namedtuple('PriceRange', ['min', 'max', 'has_undetermined'])

def ddokfarm_image_upload(instance, filename):
    now = datetime.now()
    return os.path.join('ddokfarm/images', now.strftime('%y/%m'), filename)

SHIPPING_METHOD_CHOICES = [
    ('post_parcel', '우체국 택배'),
    ('post_semi_reg', '준등기'),
    ('gs_delivery', '반택'),
    ('cu_delivery', '끼택'),
    ('etc', '기타'),
]

class FarmBasePost(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    like = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="liked_%(class)s", blank=True)
    is_sold = models.BooleanField(default=False)
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE)
    view_count = models.PositiveIntegerField(default=0)
    shipping_methods = models.CharField(max_length=200, blank=True, help_text="선택된 배송 방법들 (콤마로 구분)")
    shipping_fee = models.PositiveIntegerField(blank=True, null=True, help_text="배송비 (원)")

    class Meta:
        abstract = True

    def get_shipping_methods_list(self):
        if not self.shipping_methods:
            return []
        return [method.strip() for method in self.shipping_methods.split(',') if method.strip()]

    def get_shipping_methods_display(self):
        if not self.shipping_methods:
            return "배송 방법 미정"
        methods = self.get_shipping_methods_list()
        method_dict = dict(SHIPPING_METHOD_CHOICES)
        display_names = [method_dict.get(method, method) for method in methods]
        return ', '.join(display_names)

    def has_shipping_method(self, method):
        return method in self.get_shipping_methods_list()

class ItemPrice(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    post = GenericForeignKey('content_type', 'object_id')

    item_name = models.CharField(max_length=20, blank=True, help_text="물건명 (비어있으면 '덕N'으로 자동 표시)")
    price = models.PositiveIntegerField(help_text="개별 물건 가격")
    is_price_undetermined = models.BooleanField(default=False)
    is_sold = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.post.title} - {self.get_display_name()} ({self.get_display_price()})"

    def get_display_number(self):
        same_post_items = ItemPrice.objects.filter(content_type=self.content_type, object_id=self.object_id).order_by('id')
        return list(same_post_items).index(self) + 1

    def get_display_name(self):
        return self.item_name or f"덕{self.get_display_number()}"

    def get_display_price(self):
        return "가격 미정" if self.is_price_undetermined else f"{self.price:,}원"

class FarmMarketPost(FarmBasePost):
    CONDITION_CHOICES = [
        ('new', '미개봉'),
        ('almost_new', '거의 새것'),
        ('used', '사용감 있음'),
        ('damaged', '하자 있음'),
    ]
    SHIPPING_CHOICES = [
        ('delivery', '택배'),
        ('direct', '직거래'),
        ('both', '직거래, 택배'),
    ]

    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    shipping = models.CharField(max_length=20, choices=SHIPPING_CHOICES)
    location = models.CharField(max_length=20, blank=True, null=True)
    members = models.ManyToManyField(Member, blank=True)

    class Meta:
        abstract = True

    def get_item_prices(self):
        content_type = ContentType.objects.get_for_model(self.__class__)
        return ItemPrice.objects.filter(content_type=content_type, object_id=self.id)

    def has_multiple_items(self):
        return self.get_item_prices().count() > 1

    def get_price_range(self):
        prices_qs = self.get_item_prices()
        has_undetermined = prices_qs.filter(is_price_undetermined=True).exists()
        numeric_prices = prices_qs.filter(is_price_undetermined=False).values_list('price', flat=True)

        if numeric_prices:
            return PriceRange(min=min(numeric_prices), max=max(numeric_prices), has_undetermined=has_undetermined)
        elif has_undetermined:
            return None
        return None

    def get_price_base(self):
        price_range = self.get_price_range()
        if price_range:
            if price_range.min == price_range.max:
                return f"{price_range.min:,}원"
            return f"{price_range.min:,}원 ~ {price_range.max:,}원"
        return "가격 미정"

    def get_price_note(self):
        price_range = self.get_price_range()
        if price_range and price_range.has_undetermined:
            return "가격 미정 포함"
        return ""

    @property
    def effective_price(self):
        price_range = self.get_price_range()
        return price_range.min if price_range else 0

    @property
    def price(self):
        return self.effective_price

class ExchangeItem(models.Model):
    post = models.OneToOneField('FarmSellPost', on_delete=models.CASCADE, related_name='exchange_info')
    give_description = models.CharField(max_length=50, help_text="내가 주는 것", verbose_name="주는 것")
    want_description = models.CharField(max_length=50, help_text="내가 받고 싶은 것", verbose_name="받고 싶은 것")
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
    MD_CHOICES = [
        ('poca', '포토카드'),
        ('md', 'MD'),
        ('light_stick', '응원봉'),
        ('album', '앨범'),
        ('etc', '기타'),
    ]

    want_to = models.CharField(max_length=20, choices=WANTTO_CHOICES)
    md = models.CharField(max_length=20, choices=MD_CHOICES)
    images = GenericRelation('ddokfarm.FarmPostImage')

    @property
    def category_type(self):
        return 'sell'

    def get_main_image(self):
        main_img = self.images.filter(is_representative=True).first()
        return main_img.image.url if main_img else None

class FarmRentalPost(FarmMarketPost):
    WANTTO_CHOICES = [
        ('sell', '빌려줍니다'),
        ('buy', '빌려주세요'),
    ]

    want_to = models.CharField(max_length=20, choices=WANTTO_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    images = GenericRelation('ddokfarm.FarmPostImage')

    @property
    def category_type(self):
        return 'rental'

    def get_main_image(self):
        main_img = self.images.filter(is_representative=True).first()
        return main_img.image.url if main_img else None

class FarmSplitPost(FarmBasePost):
    ALBUM_CHOICES = [('include', '포함'), ('not_include', '미포함')]
    FAILURE_CHOICES = [('failure', '무산'), ('not_failure', '무산없음'), ('split', 'N빵')]
    PUSH_CHOICES = [('yes', '가능'), ('no', '불가능')]

    album = models.CharField(max_length=20, choices=ALBUM_CHOICES)
    where = models.CharField(max_length=100)
    when = models.DateField()
    failure = models.CharField(max_length=20, choices=FAILURE_CHOICES)
    push = models.CharField(max_length=20, choices=PUSH_CHOICES)
    images = GenericRelation('ddokfarm.FarmPostImage')
    checked_out_members = models.ManyToManyField(Member, blank=True, related_name="checked_out_split_posts")

    @property
    def category_type(self):
        return 'split'

    def get_main_image(self):
        main_img = self.images.filter(is_representative=True).first()
        return main_img.image.url if main_img else None

    def get_price_range(self):
        prices = list(self.member_prices.values_list('price', flat=True))
        if prices:
            return PriceRange(min=min(prices), max=max(prices), has_undetermined=False)
        return None

    def get_price_base(self):
        price_range = self.get_price_range()
        if price_range:
            if price_range.min == price_range.max:
                return f"{price_range.min:,}원"
            return f"{price_range.min:,}원 ~ {price_range.max:,}원"
        return "가격 미정"

    def get_price_note(self):
        return ""

    def get_display_price(self):
        return self.get_price_base()

    @property
    def price(self):
        price_range = self.get_price_range()
        return price_range.min if price_range else 0

class SplitPrice(models.Model):
    post = models.ForeignKey(FarmSplitPost, on_delete=models.CASCADE, related_name='member_prices')
    member = models.ForeignKey(Member, on_delete=models.CASCADE)
    price = models.PositiveIntegerField()

    class Meta:
        unique_together = ('post', 'member')

class SplitApplication(models.Model):
    STATUS_CHOICES = [('pending', '대기중'), ('approved', '승인됨'), ('rejected', '반려됨')]
    post = models.ForeignKey(FarmSplitPost, on_delete=models.CASCADE, related_name='applications')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    members = models.ManyToManyField(Member)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class FarmComment(models.Model):
    content = models.CharField(max_length=200)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    post = GenericForeignKey('content_type', 'object_id')

class FarmPostImage(models.Model):
    image = models.ImageField(upload_to=ddokfarm_image_upload)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    is_representative = models.BooleanField(default=False)
