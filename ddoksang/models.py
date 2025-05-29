from django.db import models
from django.conf import settings
from artist.models import Artist, Member
import json

class BdayCafe(models.Model):
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
    
    # 카페 정보 (카카오맵 API 연동)
    cafe_name = models.CharField(max_length=100, verbose_name='카페명')
    address = models.TextField(verbose_name='주소')
    road_address = models.TextField(blank=True, verbose_name='도로명주소')  # 카카오 API에서 자동 입력
    detailed_address = models.CharField(max_length=200, blank=True, verbose_name='상세주소')
    
    # 카카오맵 API 데이터
    kakao_place_id = models.CharField(max_length=50, blank=True, verbose_name='카카오 장소 ID')
    latitude = models.FloatField(verbose_name='위도')
    longitude = models.FloatField(verbose_name='경도')
    phone = models.CharField(max_length=20, blank=True, verbose_name='전화번호')
    place_url = models.URLField(blank=True, verbose_name='카카오맵 장소 URL')
    category_name = models.CharField(max_length=100, blank=True, verbose_name='카테고리')
    
    # 이벤트 정보
    start_date = models.DateField(verbose_name='시작일')
    end_date = models.DateField(verbose_name='종료일')
    start_time = models.TimeField(null=True, blank=True, verbose_name='시작시간')
    end_time = models.TimeField(null=True, blank=True, verbose_name='종료시간')
    
    # 특전 및 이벤트 정보
    special_benefits = models.TextField(blank=True, verbose_name='특전 정보')
    event_description = models.TextField(blank=True, verbose_name='이벤트 설명')
    hashtags = models.CharField(max_length=500, blank=True, verbose_name='해시태그')
    
    # 이미지
    main_image = models.ImageField(upload_to='bday_cafes/main/', null=True, blank=True, verbose_name='메인 이미지')
    poster_image = models.ImageField(upload_to='bday_cafes/poster/', null=True, blank=True, verbose_name='포스터 이미지')
    
    # 출처 및 검증
    twitter_source = models.URLField(blank=True, verbose_name='트위터 출처')
    instagram_source = models.URLField(blank=True, verbose_name='인스타 출처')
    
    # 관리 정보
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='상태')
    is_featured = models.BooleanField(default=False, verbose_name='추천 생카')
    view_count = models.PositiveIntegerField(default=0, verbose_name='조회수')
    
    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='등록일')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일')
    verified_at = models.DateTimeField(null=True, blank=True, verbose_name='승인일')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_cafes', verbose_name='승인자')
    
    class Meta:
        verbose_name = '생일카페'
        verbose_name_plural = '생일카페들'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['latitude', 'longitude']),  # 지도 검색용
            models.Index(fields=['start_date', 'end_date']),  # 날짜 검색용
            models.Index(fields=['status', 'start_date']),    # 활성 카페 검색용
        ]
    
    def __str__(self):
        # 🔥 수정: self.artist.name → self.artist.display_name
        return f"{self.artist.display_name} - {self.cafe_name} ({self.start_date})"
    
    @property
    def is_active(self):
        """현재 진행 중인 생카인지 확인"""
        from datetime import date
        today = date.today()
        return self.start_date <= today <= self.end_date and self.status == 'approved'
    
    @property
    def days_remaining(self):
        """남은 일수 계산"""
        from datetime import date
        today = date.today()
        if self.end_date > today:
            return (self.end_date - today).days
        return 0
    
    def get_kakao_map_data(self):
        """카카오맵 표시용 데이터 반환"""
        return {
            'id': self.id,
            'name': self.cafe_name,
            # 🔥 수정: self.artist.name → self.artist.display_name
            'artist': self.artist.display_name,
            # 🔥 수정: self.member.name → self.member.member_name
            'member': self.member.member_name if self.member else None,
            'latitude': float(self.latitude),
            'longitude': float(self.longitude),
            'address': self.address,
            'road_address': self.road_address,
            'phone': self.phone,
            'place_url': self.place_url,
            'start_date': self.start_date.strftime('%Y-%m-%d'),
            'end_date': self.end_date.strftime('%Y-%m-%d'),
            'cafe_type': self.get_cafe_type_display(),
            'special_benefits': self.special_benefits,
            'days_remaining': self.days_remaining,
            'main_image': self.main_image.url if self.main_image else None,
            'is_active': self.is_active,
        }

class CafeFavorite(models.Model):
    """생카 찜하기"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    cafe = models.ForeignKey(BdayCafe, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'cafe']
        verbose_name = '생카 찜'
        verbose_name_plural = '생카 찜 목록'

class TourPlan(models.Model):
    """생카 투어 플랜"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, verbose_name='투어명')
    cafes = models.ManyToManyField(BdayCafe, through='TourStop')
    tour_date = models.DateField(verbose_name='투어 예정일')
    is_public = models.BooleanField(default=False, verbose_name='공개 여부')
    
    # 카카오맵 길찾기 최적화 결과 저장
    optimized_route_data = models.JSONField(blank=True, null=True, verbose_name='최적화된 경로 데이터')
    total_distance = models.FloatField(blank=True, null=True, verbose_name='총 거리(km)')
    total_duration = models.IntegerField(blank=True, null=True, verbose_name='총 소요시간(분)')
    transportation_mode = models.CharField(
        max_length=20, 
        choices=[
            ('TRANSIT', '대중교통'),
            ('CAR', '자동차'),
            ('WALK', '도보'),
        ],
        default='TRANSIT',
        verbose_name='이동수단'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = '투어 플랜'
        verbose_name_plural = '투어 플랜들'
    
    def get_route_summary(self):
        """투어 요약 정보 반환"""
        stops = self.tourstop_set.all().order_by('order')
        return {
            'total_stops': stops.count(),
            'total_distance': self.total_distance,
            'total_duration': self.total_duration,
            'transportation': self.get_transportation_mode_display(),
            'cafes': [stop.cafe.cafe_name for stop in stops],
        }

class TourStop(models.Model):
    """투어 경유지"""
    tour = models.ForeignKey(TourPlan, on_delete=models.CASCADE)
    cafe = models.ForeignKey(BdayCafe, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(verbose_name='순서')
    
    # 카카오맵 길찾기 API 결과
    distance_to_next = models.FloatField(blank=True, null=True, verbose_name='다음 장소까지 거리(km)')
    duration_to_next = models.IntegerField(blank=True, null=True, verbose_name='다음 장소까지 소요시간(분)')
    route_info = models.JSONField(blank=True, null=True, verbose_name='경로 상세 정보')
    
    # 사용자 설정
    estimated_stay_duration = models.IntegerField(default=60, verbose_name='예상 체류 시간(분)')
    notes = models.TextField(blank=True, verbose_name='메모')
    
    class Meta:
        ordering = ['order']
        unique_together = ['tour', 'order']
        verbose_name = '투어 경유지'
        verbose_name_plural = '투어 경유지들'
    
    def __str__(self):
        return f"{self.tour.name} - {self.order}. {self.cafe.cafe_name}"

class UserSearchHistory(models.Model):
    """사용자 검색 기록 (개인화 추천용)"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    search_query = models.CharField(max_length=200, verbose_name='검색어')
    search_type = models.CharField(
        max_length=20,
        choices=[
            ('keyword', '키워드'),
            ('location', '위치'),
            ('artist', '아티스트'),
        ],
        verbose_name='검색 유형'
    )
    latitude = models.FloatField(null=True, blank=True, verbose_name='검색 위치 위도')
    longitude = models.FloatField(null=True, blank=True, verbose_name='검색 위치 경도')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = '검색 기록'
        verbose_name_plural = '검색 기록들'
        ordering = ['-created_at']