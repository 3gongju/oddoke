from django.db import models
from django.conf import settings
from artist.models import Artist, Member
from PIL import Image
import os
import json

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

    # 카페 정보 (간소화)
    cafe_name = models.CharField(max_length=100, verbose_name='카페명')
    place_name = models.CharField(max_length=100, blank=True, verbose_name='장소명')
    address = models.TextField(verbose_name='주소')
    road_address = models.TextField(blank=True, verbose_name='도로명주소')
    detailed_address = models.CharField(max_length=200, blank=True, verbose_name='상세주소')
    kakao_place_id = models.CharField(max_length=50, blank=True, verbose_name='카카오 장소 ID')
    latitude = models.FloatField(verbose_name='위도')
    longitude = models.FloatField(verbose_name='경도')
    
    # 🔧 제거된 필드들:
    # phone = models.CharField(max_length=20, blank=True, verbose_name='전화번호')  # 제거
    # place_url = models.URLField(blank=True, verbose_name='카카오맵 URL')  # 제거
    # category_name = models.CharField(max_length=100, blank=True, verbose_name='카테고리')  # 제거

    # 날짜 및 시간
    start_date = models.DateField(verbose_name='시작일')
    end_date = models.DateField(verbose_name='종료일')
    start_time = models.TimeField(null=True, blank=True, verbose_name='시작시간')
    end_time = models.TimeField(null=True, blank=True, verbose_name='종료시간')

    # 상세 정보
    special_benefits = models.TextField(blank=True, verbose_name='특전 정보')
    event_description = models.TextField(blank=True, verbose_name='이벤트 설명')
    hashtags = models.CharField(max_length=500, blank=True, verbose_name='해시태그')

    # 기존 이미지 (하위 호환성을 위해 유지)
    main_image = models.ImageField(upload_to='bday_cafes/main/', null=True, blank=True, verbose_name='메인 이미지 (구버전)')
    poster_image = models.ImageField(upload_to='bday_cafes/poster/', null=True, blank=True, verbose_name='포스터 이미지 (구버전)')

    # 출처 (간소화)
    x_source = models.URLField(blank=True, verbose_name='X 출처')
    # instagram_source = models.URLField(blank=True, verbose_name='인스타 출처')  # 제거

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
        """현재 운영중인지 확인"""
        from datetime import date
        today = date.today()
        return (self.status == 'approved' and 
                self.start_date <= today <= self.end_date)

    @property
    def days_remaining(self):
        """남은 일수 계산"""
        from datetime import date
        today = date.today()
        if self.end_date > today:
            return (self.end_date - today).days
        return 0

    def get_main_image(self):
        """대표 이미지 반환 (새로운 다중 이미지 시스템 우선)"""
        # 새로운 다중 이미지 시스템에서 대표 이미지 찾기
        main_img = self.images.filter(is_main=True).first()
        if main_img and main_img.image:
            return main_img.image.url
        
        # 대표 이미지가 없으면 첫 번째 이미지 사용
        first_img = self.images.first()
        if first_img and first_img.image:
            return first_img.image.url
            
        # 새로운 이미지가 없으면 기존 main_image 사용 (하위 호환성)
        if self.main_image:
            return self.main_image.url
            
        return None

    def get_all_images(self):
        """모든 이미지 정보 반환"""
        images_data = []
        
        # 새로운 다중 이미지들
        for img in self.images.all().order_by('order', 'created_at'):
            images_data.append(img.get_image_data())
        
        # 기존 이미지들도 포함 (하위 호환성) - 새로운 이미지가 없을 때만
        if not images_data:
            if self.main_image:
                images_data.append({
                    'id': f'legacy_main_{self.id}',
                    'url': self.main_image.url,
                    'type': 'main',
                    'type_display': '메인 이미지',
                    'caption': '',
                    'order': -1,
                    'is_main': True,
                    'width': None,
                    'height': None,
                    'file_size': None,
                })
            
            if self.poster_image:
                images_data.append({
                    'id': f'legacy_poster_{self.id}',
                    'url': self.poster_image.url,
                    'type': 'poster',
                    'type_display': '포스터',
                    'caption': '',
                    'order': 0,
                    'is_main': False,
                    'width': None,
                    'height': None,
                    'file_size': None,
                })
        
        return images_data

    def get_kakao_map_data(self):
        """카카오맵용 데이터 (간소화됨)"""
        try:
            # latitude, longitude 유효성 검사
            lat = float(self.latitude) if self.latitude else None
            lng = float(self.longitude) if self.longitude else None
            
            if lat is None or lng is None:
                return None
                
            return {
                'id': self.id,
                'name': self.cafe_name,
                'place_name': self.place_name or self.cafe_name,  # place_name 우선, 없으면 cafe_name
                'artist': self.artist.display_name,
                'member': self.member.member_name if self.member else None,
                'latitude': lat,
                'longitude': lng,
                'address': self.address or '',
                'road_address': self.road_address or '',
                # 🔧 카카오맵 URL 동적 생성
                'place_url': f'https://map.kakao.com/link/map/{self.cafe_name},{lat},{lng}',
                'start_date': self.start_date.strftime('%Y-%m-%d'),
                'end_date': self.end_date.strftime('%Y-%m-%d'),
                'cafe_type': self.get_cafe_type_display(),
                'special_benefits': self.special_benefits or '',
                'days_remaining': self.days_remaining,
                'main_image': self.get_main_image(),
                'is_active': self.is_active,
                'images': self.get_all_images(),
            }
        except (ValueError, AttributeError, TypeError) as e:
            return None

    @property
    def special_benefits_list(self):
        """특전 정보를 리스트로 반환"""
        if not self.special_benefits:
            return []
        return [benefit.strip() for benefit in self.special_benefits.split(',') if benefit.strip()]

    @property
    def hashtags_list(self):
        """해시태그를 리스트로 반환"""
        if not self.hashtags:
            return []
        # 공백과 #으로 분할하여 정리
        tags = []
        for tag in self.hashtags.replace('#', ' ').split():
            tag = tag.strip()
            if tag:
                tags.append(tag)
        return tags


class BdayCafeImage(models.Model):
    """생일카페 다중 이미지"""
    IMAGE_TYPE_CHOICES = [
        ('main', '메인 이미지'),
        ('poster', '포스터'),
        ('menu', '메뉴판'),
        ('interior', '내부 전경'),
        ('exterior', '외부 전경'),
        ('goods', '굿즈/특전'),
        ('event', '이벤트'),
        ('other', '기타'),
    ]
    
    cafe = models.ForeignKey(BdayCafe, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='bday_cafes/images/%Y/%m/', verbose_name='이미지')
    image_type = models.CharField(max_length=20, choices=IMAGE_TYPE_CHOICES, default='other', verbose_name='이미지 유형')
    caption = models.CharField(max_length=200, blank=True, verbose_name='이미지 설명')
    order = models.PositiveIntegerField(default=0, verbose_name='순서')
    is_main = models.BooleanField(default=False, verbose_name='대표 이미지')
    
    # 이미지 메타데이터
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True, verbose_name='파일 크기(bytes)')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = '생카 이미지'
        verbose_name_plural = '생카 이미지들'
        indexes = [
            models.Index(fields=['cafe', 'is_main']),
            models.Index(fields=['cafe', 'order']),
        ]
    
    def save(self, *args, **kwargs):
            # 대표 이미지가 설정되면 같은 카페의 다른 이미지들의 is_main을 False로 변경
            if self.is_main:
                BdayCafeImage.objects.filter(cafe=self.cafe, is_main=True).exclude(pk=self.pk).update(is_main=False)
            
            super().save(*args, **kwargs)
            
            # 이미지 최적화 및 메타데이터 저장
            if self.image and hasattr(self.image, 'path') and os.path.exists(self.image.path):
                try:
                    with Image.open(self.image.path) as img:
                        self.width, self.height = img.size
                        self.file_size = os.path.getsize(self.image.path)
                        
                        # 이미지 최적화 (너무 클 경우)
                        max_size = (1920, 1920)
                        if img.width > max_size[0] or img.height > max_size[1]:
                            img.thumbnail(max_size, Image.Resampling.LANCZOS)
                            img.save(self.image.path, optimize=True, quality=85)
                            
                            self.width, self.height = img.size
                            self.file_size = os.path.getsize(self.image.path)
                    
                    # 메타데이터 업데이트 (무한 루프 방지)
                    if self.pk:
                        BdayCafeImage.objects.filter(pk=self.pk).update(
                            width=self.width,
                            height=self.height,
                            file_size=self.file_size
                        )
                except Exception as e:
                    print(f"이미지 처리 중 오류: {e}")
        
    def __str__(self):
        return f"{self.cafe.cafe_name} - {self.get_image_type_display()}"
    
    
    @property
    def thumbnail_url(self):
        """썸네일 URL (나중에 썸네일 생성 시스템 구현 예정)"""
        return self.image.url if self.image else None
    
    def get_image_data(self):
        """프론트엔드용 이미지 데이터"""
        return {
            'id': self.id,
            'url': self.image.url if self.image else None,
            'type': self.image_type,
            'type_display': self.get_image_type_display(),
            'caption': self.caption,
            'order': self.order,
            'is_main': self.is_main,
            'width': self.width,
            'height': self.height,
            'file_size': self.file_size,
        }


class CafeFavorite(models.Model):
    """카페 즐겨찾기"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    cafe = models.ForeignKey(BdayCafe, on_delete=models.CASCADE, related_name='favoritecafes')  # related_name
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'cafe')
        verbose_name = '카페 즐겨찾기'


class UserSearchHistory(models.Model):
    """사용자 검색 기록"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    search_query = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = '검색 기록'

class TourPlan(models.Model):
    """투어 계획"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=100, verbose_name='투어명')
    total_distance = models.FloatField(null=True, blank=True, verbose_name='총 거리(km)')
    estimated_time = models.PositiveIntegerField(null=True, blank=True, verbose_name='예상 시간(분)')
    start_point = models.JSONField(null=True, blank=True, verbose_name='시작점 정보')
    route_data = models.JSONField(null=True, blank=True, verbose_name='경로 데이터')
    is_public = models.BooleanField(default=False, verbose_name='공개 여부')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = '투어 계획'
        verbose_name_plural = '투어 계획들'
        ordering = ['-updated_at']

class TourStop(models.Model):
    """투어 정거장"""
    plan = models.ForeignKey(TourPlan, on_delete=models.CASCADE, related_name='stops')
    cafe = models.ForeignKey(BdayCafe, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(verbose_name='순서')
    arrival_time = models.TimeField(null=True, blank=True, verbose_name='도착 예정시간')
    stay_duration = models.PositiveIntegerField(default=30, verbose_name='체류시간(분)')
    notes = models.TextField(blank=True, verbose_name='메모')
    
    class Meta:
        verbose_name = '투어 정거장'
        verbose_name_plural = '투어 정거장들'
        ordering = ['order']
        unique_together = ('plan', 'order')