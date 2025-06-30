# ddoksang/models.py 
from django.db import models
from django.conf import settings
from artist.models import Artist, Member
from datetime import datetime
from PIL import Image
import os
import json

class BdayCafe(models.Model):
    """생일카페 등록 모델 - 이미지 갤러리 포함"""
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

    # 카페 정보
    cafe_name = models.CharField(max_length=100, verbose_name='카페명')
    place_name = models.CharField(max_length=100, blank=True, verbose_name='장소명')
    address = models.TextField(verbose_name='주소')
    road_address = models.TextField(blank=True, verbose_name='도로명주소')
    detailed_address = models.CharField(max_length=200, blank=True, verbose_name='상세주소')

    kakao_place_id = models.CharField(max_length=50, blank=True, verbose_name='카카오 장소 ID')
    latitude = models.FloatField(verbose_name='위도')
    longitude = models.FloatField(verbose_name='경도')

    # 날짜 및 시간
    start_date = models.DateField(verbose_name='시작일')
    end_date = models.DateField(verbose_name='종료일')
    
    # 카페 즐겨찾기
    favorited_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='favorite_cafes',
        blank=True,
        verbose_name='찜한 사용자들'
    )


    # 상세 정보
    special_benefits = models.TextField(blank=True, verbose_name='특전 정보')
    event_description = models.TextField(blank=True, verbose_name='이벤트 설명')

    # ✅ 이미지 갤러리 (JSON 형태로 저장)
    image_gallery = models.JSONField(default=list, blank=True, verbose_name='이미지 갤러리')
    # 예시 구조:
    # [
    #   {
    #     "id": "img_1",
    #     "url": "/media/bday_cafes/images/2025/01/image1.jpg",
    #     "type": "main",
    #     "is_main": true,
    #     "order": 0,
    #     "width": 1200,
    #     "height": 800,
    #     "file_size": 245760
    #   },
    #   ...
    # ]

    # 출처
    x_source = models.URLField(blank=True, verbose_name='X 출처')

    # 상태 정보
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='상태')
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
    
    @property
    def days_until_start(self):
        """시작까지 남은 일수 계산"""
        from datetime import date
        today = date.today()
        if self.start_date > today:
            return (self.start_date - today).days
        return 0

    # 이미지 관련 메서드들 (JSON 기반)
# ddoksang/models.py에 추가 - 기존 get_main_image는 그대로 두고 새 메서드 추가

    def get_main_image(self):
        """대표 이미지 URL 반환 - 기존 방식 (페이지 표시용)"""
        if not self.image_gallery:
            return None
            
        # is_main=True인 이미지 찾기
        for img in self.image_gallery:
            if img.get('is_main', False) and img.get('url'):
                return img['url']  # 원본 URL 그대로 반환
        
        # 대표 이미지가 없으면 첫 번째 이미지
        if self.image_gallery and self.image_gallery[0].get('url'):
            return self.image_gallery[0]['url']
            
        return None
    
    # models.py에 메서드 추가

    def get_all_images_with_s3_urls(self):
        """모든 이미지를 S3 URL로 변환해서 반환 (카카오톡 공유용)"""
        if not self.image_gallery:
            return []
        
        from django.conf import settings
        from urllib.parse import unquote
        
        images_with_s3 = []
        
        for img in sorted(self.image_gallery, key=lambda x: x.get('order', 0)):
            url = img.get('url', '')
            
            # 이미 절대경로면 그대로 사용
            if url.startswith('http'):
                s3_url = url
            else:
                # S3 URL로 변환
                clean_url = unquote(url)
                
                # /media/ 제거
                if clean_url.startswith('/media/'):
                    clean_path = clean_url[7:]
                else:
                    clean_path = clean_url
                
                # S3 URL 생성
                if hasattr(settings, 'AWS_STORAGE_BUCKET_NAME') and settings.AWS_STORAGE_BUCKET_NAME:
                    bucket = settings.AWS_STORAGE_BUCKET_NAME
                    region = getattr(settings, 'AWS_S3_REGION_NAME', 'ap-northeast-2')
                    s3_url = f"https://{bucket}.s3.{region}.amazonaws.com/{clean_path}"
                else:
                    # 로컬 개발환경에서는 기본 URL 사용
                    s3_url = url
            
            images_with_s3.append({
                'url': s3_url,
                'image_url': s3_url,  # JavaScript에서 사용하는 키
                'type': img.get('type', ''),
                'type_display': img.get('type', ''),
                'caption': img.get('caption', ''),
                'alt': img.get('caption', self.cafe_name),
                'order': img.get('order', 0),
                'is_main': img.get('is_main', False)
            })
        
        return images_with_s3

    def get_kakao_share_image(self):
        """카카오톡 공유용 이미지 URL - 카카오톡 지원 형식으로 변환"""
        
        if not self.image_gallery:
            return "https://via.placeholder.com/600x400/FEE500/3C1E1E?text=생일카페"
        
        from django.conf import settings
        from urllib.parse import unquote
        
        # 카카오톡 지원 형식 (AVIF 제외)
        KAKAO_SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        
        # 1. 카카오톡 지원 형식의 이미지 우선 검색
        kakao_compatible_image = None
        for img in self.image_gallery:
            url = img.get('url', '')
            if any(fmt in url.lower() for fmt in KAKAO_SUPPORTED_FORMATS):
                if img.get('is_main', False):
                    kakao_compatible_image = img
                    break
                elif not kakao_compatible_image:  # 첫 번째 호환 이미지 저장
                    kakao_compatible_image = img
        
        # 2. 호환 이미지가 없으면 AVIF → JPG 변환 시도
        if not kakao_compatible_image:
            for img in self.image_gallery:
                url = img.get('url', '')
                if '.avif' in url.lower():
                    if img.get('is_main', False):
                        kakao_compatible_image = img
                        break
                    elif not kakao_compatible_image:
                        kakao_compatible_image = img
        
        # 3. 그래도 없으면 첫 번째 이미지
        if not kakao_compatible_image:
            kakao_compatible_image = self.image_gallery[0]
        
        if not kakao_compatible_image or not kakao_compatible_image.get('url'):
            return "https://via.placeholder.com/600x400/FEE500/3C1E1E?text=생일카페"
        
        url = kakao_compatible_image.get('url')
        
        # 절대경로 처리
        if url.startswith('http'):
            # AVIF → JPG 변환
            if '.avif' in url.lower():
                jpg_url = url.replace('.avif', '.jpg').replace('.AVIF', '.jpg')
                print(f"📸 카카오톡 공유: AVIF → JPG 변환 시도")
                print(f"   원본: {url}")
                print(f"   변환: {jpg_url}")
                return jpg_url
            return url
        
        # S3 URL로 변환
        clean_url = unquote(url)
        
        # /media/ 제거
        if clean_url.startswith('/media/'):
            clean_path = clean_url[7:]
        else:
            clean_path = clean_url
        
        # AVIF 확장자 → JPG 변환
        if clean_path.lower().endswith('.avif'):
            clean_path = clean_path.rsplit('.', 1)[0] + '.jpg'
            print(f"📸 카카오톡 공유: 경로에서 AVIF → JPG 변환")
        
        # S3 URL 생성
        if hasattr(settings, 'AWS_STORAGE_BUCKET_NAME') and settings.AWS_STORAGE_BUCKET_NAME:
            bucket = settings.AWS_STORAGE_BUCKET_NAME
            region = getattr(settings, 'AWS_S3_REGION_NAME', 'ap-northeast-2')
            s3_url = f"https://{bucket}.s3.{region}.amazonaws.com/{clean_path}"
            print(f"📸 최종 카카오톡 공유 이미지: {s3_url}")
            return s3_url
        
        # S3 설정이 없으면 기본 이미지
        return "https://via.placeholder.com/600x400/FEE500/3C1E1E?text=생일카페"


    def get_all_images(self):
        """모든 이미지 정보 반환"""
        if not self.image_gallery:
            return []
        
        # order로 정렬해서 반환
        return sorted(self.image_gallery, key=lambda x: x.get('order', 0))

    def add_image(self, image_file, image_type='other', is_main=False, order=None):
        """이미지 추가 메서드"""
        import uuid
        from django.core.files.storage import default_storage
        
        if not self.image_gallery:
            self.image_gallery = []
        
        # 순서 설정
        if order is None:
            order = len(self.image_gallery)
        
        # 대표 이미지 설정시 기존 대표 이미지 해제
        if is_main:
            for img in self.image_gallery:
                img['is_main'] = False
        
        # 이미지 저장 및 메타데이터 추출
        now = datetime.now()
        date_path = now.strftime('%y/%m')
        file_path = f'ddoksang/images/{date_path}/{image_file.name}'

        saved_path = default_storage.save(file_path, image_file)
        
        # 이미지 메타데이터 (S3 환경에 맞게 수정)
        width, height, file_size = None, None, None
        try:
            # 파일 크기
            file_size = image_file.size
            
            # PIL로 이미지 크기 확인 (메모리에서)
            from PIL import Image
            image_file.seek(0)  # 파일 포인터 초기화
            with Image.open(image_file) as img:
                width, height = img.size
        except Exception as e:
            print(f"이미지 메타데이터 추출 실패: {e}")
        
        # 이미지 정보 추가
        image_data = {
            'id': str(uuid.uuid4()),
            'url': default_storage.url(saved_path),
            'file_path': saved_path,  # S3 키 저장 (삭제시 필요)
            'type': image_type,
            'is_main': is_main,
            'order': order,
            'width': width,
            'height': height,
            'file_size': file_size,
            'created_at': datetime.now().isoformat()
        }
        
        self.image_gallery.append(image_data)
        self.save(update_fields=['image_gallery'])
        
        print(f"✅ 덕생 이미지 저장 성공: {saved_path}")
        return image_data

    def remove_image(self, image_id):
        """이미지 제거 메서드 - S3 환경에 맞게 수정"""
        if not self.image_gallery:
            return False
        
        # 해당 이미지 찾기 및 제거
        for i, img in enumerate(self.image_gallery):
            if img.get('id') == image_id:
                # S3에서 파일 삭제
                try:
                    from django.core.files.storage import default_storage
                    # file_path가 있으면 사용, 없으면 URL에서 추출
                    file_path = img.get('file_path')
                    if not file_path:
                        # 기존 방식 호환성 (URL에서 경로 추출)
                        file_url = img.get('url', '')
                        if default_storage.base_url in file_url:
                            file_path = file_url.replace(default_storage.base_url, '')
                        else:
                            # S3 URL 형태에서 키 추출
                            file_path = file_url.split('amazonaws.com/')[-1]
                    
                    if file_path and default_storage.exists(file_path):
                        default_storage.delete(file_path)
                        print(f"✅ S3 파일 삭제 성공: {file_path}")
                except Exception as e:
                    print(f"❌ S3 파일 삭제 실패: {e}")
                
                # 목록에서 제거
                self.image_gallery.pop(i)
                self.save(update_fields=['image_gallery'])
                return True
        
        return False

    def set_main_image(self, image_id):
        """대표 이미지 설정"""
        if not self.image_gallery:
            return False
        
        changed = False
        for img in self.image_gallery:
            if img.get('id') == image_id:
                img['is_main'] = True
                changed = True
            else:
                img['is_main'] = False
        
        if changed:
            self.save(update_fields=['image_gallery'])
        
        return changed

    def reorder_images(self, image_orders):
        """이미지 순서 변경"""
        # image_orders: [{'id': 'img_1', 'order': 0}, {'id': 'img_2', 'order': 1}, ...]
        if not self.image_gallery:
            return False
        
        order_map = {item['id']: item['order'] for item in image_orders}
        
        for img in self.image_gallery:
            if img.get('id') in order_map:
                img['order'] = order_map[img['id']]
        
        self.save(update_fields=['image_gallery'])
        return True

    @property
    def special_benefits_list(self):
        """특전 정보를 리스트로 반환"""
        if not self.special_benefits:
            return []
        return [benefit.strip() for benefit in self.special_benefits.split(',') if benefit.strip()]


    @property
    def image_count(self):
        """이미지 개수 반환"""
        return len(self.image_gallery) if self.image_gallery else 0

