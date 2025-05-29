from django.db import models
from django.conf import settings
from artist.models import Artist, Member


class BdayCafe(models.Model):
    """생일카페 등록 모델"""
    CAFE_TYPE_CHOICES = [
        ('bday', '생일'),
        ('debut', '데뷔일'),
        ('comeback', '컴백'),
        ('concert', '콘서트'),
        ('other', '기타'),
    ]

    STATUS_CHOICES = [
        ('pending', '승인 대기'),
        ('approved', '승인됨'),
        ('rejected', '거부됨'),
        ('expired', '만료됨'),
    ]

    # 기본 정보
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name='등록자')
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE, verbose_name='아티스트')
    member = models.ForeignKey(Member, on_delete=models.CASCADE, null=True, blank=True, verbose_name='멤버')
    cafe_type = models.CharField(max_length=20, choices=CAFE_TYPE_CHOICES, default='bday', verbose_name='카페 유형')

    # 카페 정보 (카카오맵 연동)
    cafe_name = models.CharField(max_length=100, verbose_name='카페명')
    address = models.TextField(verbose_name='주소')
    road_address = models.TextField(blank=True, verbose_name='도로명주소')
    detailed_address = models.CharField(max_length=200, blank=True, verbose_name='상세주소')
    kakao_place_id = models.CharField(max_length=50, blank=True, verbose_name='카카오 장소 ID')
    latitude = models.FloatField(verbose_name='위도')
    longitude = models.FloatField(verbose_name='경도')
    phone = models.CharField(max_length=20, blank=True, verbose_name='전화번호')
    place_url = models.URLField(blank=True, verbose_name='카카오맵 URL')
    category_name = models.CharField(max_length=100, blank=True, verbose_name='카테고리')

    # 날짜 및 시간
    start_date = models.DateField(verbose_name='시작일')
    end_date = models.DateField(verbose_name='종료일')
    start_time = models.TimeField(null=True, blank=True, verbose_name='시작시간')
    end_time = models.TimeField(null=True, blank=True, verbose_name='종료시간')

    # 상세 정보
    special_benefits = models.TextField(blank=True, verbose_name='특전 정보')
    event_description = models.TextField(blank=True, verbose_name='이벤트 설명')
    hashtags = models.CharField(max_length=500, blank=True, verbose_name='해시태그')

    # 이미지
    main_image = models.ImageField(upload_to='bday_cafes/main/', null=True, blank=True, verbose_name='메인 이미지')
    poster_image = models.ImageField(upload_to='bday_cafes/poster/', null=True, blank=True, verbose_name='포스터 이미지')

    # 출처
    twitter_source = models.URLField(blank=True, verbose_name='트위터 출처')
    instagram_source = models.URLField(blank=True, verbose_name='인스타 출처')

    # 상태 정보
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='상태')
    is_featured = models.BooleanField(default=False, verbose_name='추천 여부')
    view_count = models.PositiveIntegerField(default=0, verbose_name='조회수')

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='등록일')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일')
    verified_at = models.DateTimeField(null=True, blank=True, verbose_name='승인일')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='verified_cafes', verbose_name='승인자')

    class Meta:
        verbose_name = '생일카페'
        verbose_name_plural = '생일카페 목록'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['latitude', 'longitude']),
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['status', 'start_date']),
        ]

    def __str__(self):
        return f"{self.artist.display_name} - {self.cafe_name}"

    @property
    def is_active(self):
        from datetime import date
        today = date.today()
        return self.status == 'approved' and self.start_date <= today <= self.end_date

    @property
    def days_remaining(self):
        from datetime import date
        today = date.today()
        if self.end_date > today:
            return (self.end_date - today).days
        return 0

    def get_kakao_map_data(self):
        return {
            'id': self.id,
            'name': self.cafe_name,
            'artist': self.artist.display_name,
            'member': self.member.member_name if self.member else None,
            'latitude': float(self.latitude),
            'longitude': float(self.longitude),
            'address': self.address,
            'road_address': self.road_address,
            'start_date': self.start_date.strftime('%Y-%m-%d'),
            'end_date': self.end_date.strftime('%Y-%m-%d'),
            'main_image': self.main_image.url if self.main_image else None,
            'is_active': self.is_active,
        }


class CafeFavorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    cafe = models.ForeignKey(BdayCafe, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'cafe']
        verbose_name = '생카 찜'
        verbose_name_plural = '생카 찜 목록'


class TourPlan(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, verbose_name='투어명')
    cafes = models.ManyToManyField(BdayCafe, through='TourStop')
    tour_date = models.DateField(verbose_name='투어 예정일')
    is_public = models.BooleanField(default=False, verbose_name='공개 여부')
    optimized_route_data = models.JSONField(blank=True, null=True)
    total_distance = models.FloatField(blank=True, null=True)
    total_duration = models.IntegerField(blank=True, null=True)
    transportation_mode = models.CharField(
        max_length=20,
        choices=[
            ('TRANSIT', '대중교통'),
            ('CAR', '자동차'),
            ('WALK', '도보'),
        ],
        default='TRANSIT',
        verbose_name='이동 수단'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '투어 플랜'
        verbose_name_plural = '투어 플랜 목록'


class TourStop(models.Model):
    tour = models.ForeignKey(TourPlan, on_delete=models.CASCADE)
    cafe = models.ForeignKey(BdayCafe, on_delete=models.CASCADE)
    order = models.PositiveIntegerField()
    distance_to_next = models.FloatField(blank=True, null=True)
    duration_to_next = models.IntegerField(blank=True, null=True)
    route_info = models.JSONField(blank=True, null=True)
    estimated_stay_duration = models.IntegerField(default=60)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['order']
        unique_together = ['tour', 'order']
        verbose_name = '투어 경유지'
        verbose_name_plural = '투어 경유지 목록'


class UserSearchHistory(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    search_query = models.CharField(max_length=200)
    search_type = models.CharField(
        max_length=20,
        choices=[
            ('keyword', '키워드'),
            ('location', '위치'),
            ('artist', '아티스트'),
        ]
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '검색 기록'
        verbose_name_plural = '검색 기록 목록'
        ordering = ['-created_at']
