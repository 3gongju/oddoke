import json
import math
import logging
from datetime import timedelta

from django.conf import settings
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Q, F
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.cache import cache_page
from django.db import transaction
from django.core.paginator import Paginator
from django.core.cache import cache

from .models import BdayCafe, BdayCafeImage, CafeFavorite, TourPlan, TourStop, UserSearchHistory
from .forms import BdayCafeForm, BdayCafeImageForm
from artist.models import Artist, Member

# 로깅 설정
logger = logging.getLogger(__name__)

# 상수 정의
NEARBY_CAFE_RADIUS = getattr(settings, 'NEARBY_CAFE_RADIUS', 5)
WALKING_SPEED_KMPH = getattr(settings, 'WALKING_SPEED_KMPH', 5)
DEFAULT_PAGE_SIZE = getattr(settings, 'DEFAULT_PAGE_SIZE', 10)
MAX_NEARBY_CAFES = getattr(settings, 'MAX_NEARBY_CAFES', 50)


# === 유틸리티 함수 ===
# 로깅 설정
logger = logging.getLogger(__name__)

# 상수 정의
NEARBY_CAFE_RADIUS = getattr(settings, 'NEARBY_CAFE_RADIUS', 5)
WALKING_SPEED_KMPH = getattr(settings, 'WALKING_SPEED_KMPH', 5)
DEFAULT_PAGE_SIZE = getattr(settings, 'DEFAULT_PAGE_SIZE', 10)
MAX_NEARBY_CAFES = getattr(settings, 'MAX_NEARBY_CAFES', 50)


# === 유틸리티 함수 ===
def admin_required(view_func):
    """관리자 권한 필요 데코레이터"""
    return user_passes_test(lambda u: u.is_superuser or u.is_staff)(view_func)


def get_user_favorites(user):
    """사용자 찜 목록 조회"""
    if user.is_authenticated:
        return list(CafeFavorite.objects.filter(user=user).values_list('cafe_id', flat=True))
    return []


def validate_coordinates(lat, lng):
    """좌표 유효성 검증"""
    try:
        lat_float = float(lat)
        lng_float = float(lng)
        
        if not (-90 <= lat_float <= 90):
            return False, "위도는 -90도에서 90도 사이여야 합니다."
        if not (-180 <= lng_float <= 180):
            return False, "경도는 -180도에서 180도 사이여야 합니다."
        
        return True, (lat_float, lng_float)
    except (ValueError, TypeError):
        return False, "잘못된 좌표 형식입니다."



def calculate_distance(lat1, lon1, lat2, lon2):
    """두 지점 간 거리 계산 (하버사인 공식)"""
    try:
        R = 6371  # 지구 반지름 (km)
        lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
        lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    except (ValueError, TypeError) as e:
        logger.warning(f"거리 계산 오류: {e}")
        return 0


def get_nearby_cafes(center_lat, center_lng, radius_km=None, exclude_id=None, limit=None):
    """주변 생일카페 조회 (최적화된 버전)"""
    if radius_km is None:
        radius_km = NEARBY_CAFE_RADIUS
    if limit is None:
        limit = DEFAULT_PAGE_SIZE
        
    # 캐시 키 생성
    cache_key = f"nearby_cafes_{center_lat}_{center_lng}_{radius_km}_{exclude_id}_{limit}"
    cached_result = cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # 기본 쿼리 최적화
    base_query = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member').only(
        'id', 'cafe_name', 'latitude', 'longitude', 'start_date', 'end_date',
        'address', 'special_benefits', 'artist__display_name', 'member__member_name'
    )
    
    if exclude_id:
        base_query = base_query.exclude(id=exclude_id)
    
    nearby_cafes = []
    
    try:
        for cafe in base_query:
            if not (cafe.latitude and cafe.longitude):
                continue
                
            distance = calculate_distance(
                center_lat, center_lng,
                float(cafe.latitude), float(cafe.longitude)
            )
            
            if distance <= radius_km:
                cafe.distance = distance
                # 도보 시간 계산 (분 단위)
                cafe.duration = max(1, int(distance * 60 / WALKING_SPEED_KMPH))
                nearby_cafes.append(cafe)
    
    except Exception as e:
        logger.error(f"주변 카페 조회 중 오류: {e}")
        return []
    
    # 거리순 정렬 후 제한
    nearby_cafes.sort(key=lambda x: x.distance)
    result = nearby_cafes[:limit]
    
    # 캐시 저장 (5분)
    cache.set(cache_key, result, 300)
    return result


def get_safe_cafe_map_data(cafes):
    """안전한 카페 지도 데이터 생성"""
    cafes_data = []
    for cafe in cafes:
        try:
            cafe_data = cafe.get_kakao_map_data()
            # 필수 데이터 검증
            if (cafe_data.get('latitude') and cafe_data.get('longitude') and 
                isinstance(cafe_data['latitude'], (int, float)) and 
                isinstance(cafe_data['longitude'], (int, float))):
                cafes_data.append(cafe_data)
        except (AttributeError, ValueError, TypeError) as e:
            logger.warning(f"카페 {cafe.id} 지도 데이터 생성 오류: {e}")
            continue
        except Exception as e:
            logger.error(f"카페 {cafe.id} 예상치 못한 오류: {e}")
            continue
    
    return cafes_data


# === 메인 뷰 ===
def bday_cafe_detail(request, cafe_id):
    """생일카페 상세 페이지"""
    cafe = get_object_or_404(BdayCafe, id=cafe_id, status='approved')
    is_favorited = False
    
    if request.user.is_authenticated:
        is_favorited = CafeFavorite.objects.filter(user=request.user, cafe=cafe).exists()
        # 조회수 증가 (원자적 연산)
        BdayCafe.objects.filter(id=cafe_id).update(view_count=F('view_count') + 1)
    
    # 주변 생일카페 조회
    nearby_cafes = []
    if cafe.latitude and cafe.longitude:
        try:
            nearby_cafes = get_nearby_cafes(
                float(cafe.latitude), 
                float(cafe.longitude), 
                exclude_id=cafe.id,
                limit=5
            )
        except (ValueError, TypeError) as e:
            logger.warning(f"주변 카페 조회 오류: {e}")
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'cafe': cafe,
        'is_favorited': is_favorited,
        'nearby_cafes': nearby_cafes,
        'user_favorites': user_favorites,
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/detail.html', context)


@login_required
def create_cafe(request):
    if request.method == 'GET':
        form = BdayCafeForm()
        image_form = BdayCafeImageForm()
        artists = Artist.objects.all().order_by('display_name')
        
        context = {
            'form': form,
            'image_form': image_form,
            'artists': artists,
            'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        }
        return render(request, 'ddoksang/create.html', context)
    
    elif request.method == 'POST':
        # POST 데이터를 폼에 맞게 변환
        form_data = request.POST.copy()
        
        # 아티스트 유효성 검증 및 매핑
        artist_id = form_data.get('artist_id')
        
        if not artist_id:
            messages.error(request, "아티스트를 선택해주세요.")
            return redirect('ddoksang:create')
            
        try:
            artist = Artist.objects.get(id=artist_id)
            form_data['artist'] = artist.id
        except Artist.DoesNotExist:
            messages.error(request, "유효하지 않은 아티스트입니다.")
            return redirect('ddoksang:create')

        # 멤버 유효성 검증 및 매핑 (선택적)
        member_id = form_data.get('member_id')
        
        if member_id:
            try:
                member = Member.objects.get(id=member_id)
                form_data['member'] = member.id
            except Member.DoesNotExist:
                messages.warning(request, "유효하지 않은 멤버입니다. 멤버 정보를 제외하고 등록합니다.")
                form_data['member'] = ''
        else:
            form_data['member'] = ''

        # 🔧 카카오맵 API 데이터 처리 추가
        kakao_place_data = request.POST.get('kakao_place_data')
        if kakao_place_data:
            try:
                place_info = json.loads(kakao_place_data)
                # place_name 추가
                if 'place_name' in place_info:
                    form_data['place_name'] = place_info['place_name']
                    print("place_name:", place_info['place_name'])
                    
                # 기타 카카오맵 데이터도 업데이트
                if 'address_name' in place_info:
                    form_data['address'] = place_info['address_name']
                if 'road_address_name' in place_info:
                    form_data['road_address'] = place_info['road_address_name']
                if 'phone' in place_info:
                    form_data['phone'] = place_info['phone']
                if 'place_url' in place_info:
                    form_data['place_url'] = place_info['place_url']
                if 'category_name' in place_info:
                    form_data['category_name'] = place_info['category_name']
                if 'id' in place_info:
                    form_data['kakao_place_id'] = place_info['id']
                if 'x' in place_info:
                    form_data['longitude'] = place_info['x']
                if 'y' in place_info:
                    form_data['latitude'] = place_info['y']
            except json.JSONDecodeError:
                messages.warning(request, "카카오맵 정보 처리 중 오류가 발생했습니다.")

        # 특전 정보 처리
        perks = request.POST.getlist('perks')
        if perks:
            form_data['special_benefits'] = ', '.join(perks)

        # artist_id, member_id 제거 (폼에서 인식하지 않는 필드)
        if 'artist_id' in form_data:
            del form_data['artist_id']
        if 'member_id' in form_data:
            del form_data['member_id']
        
        form = BdayCafeForm(form_data, request.FILES)

        if form.is_valid():
            try:
                with transaction.atomic():
                    cafe = form.save(commit=False)
                    cafe.submitted_by = request.user
                    cafe.status = 'pending'
                    
                    cafe.place_name = form.cleaned_data.get('place_name')
                    
                    cafe.save()

                    # 다중 이미지 저장
                    images = request.FILES.getlist('images')
                        
                    for idx, image_file in enumerate(images):
                        image_type = 'main' if idx == 0 else 'other'
                        is_main = idx == 0
                        
                        BdayCafeImage.objects.create(
                            cafe=cafe,
                            image=image_file,
                            image_type=image_type,
                            order=idx,
                            is_main=is_main,
                        )
                
                    # 🔧 캐시 무효화 (새로운 카페가 추가되었으므로)
                    cache.delete_many([
                        'featured_cafes',
                        'latest_cafes',
                        'admin_stats',
                    ])
                    
                    messages.success(request, f"'{cafe.cafe_name}' 생일카페가 성공적으로 등록되었습니다! 관리자 승인 후 공개됩니다.")

                    # 🔧 올바른 URL로 리다이렉트
                    return redirect('ddoksang:create_success', cafe_id=cafe.id)

            except Exception as e:
                logger.error(f"카페 등록 중 오류: {str(e)}")
                messages.error(request, f"등록 중 오류가 발생했습니다: {str(e)}")
        else:
            # 폼 검증 실패
            error_messages = []
            for field, errors in form.errors.items():
                for error in errors:
                    error_messages.append(f"{field}: {error}")
            messages.error(request, f"입력 정보를 확인해주세요: {', '.join(error_messages)}")
        
        return redirect('ddoksang:create')

    
@login_required
def cafe_create_success(request, cafe_id):
    """생일카페 등록 완료 페이지"""
    try:
        # 사용자가 등록한 카페만 볼 수 있도록
        cafe = get_object_or_404(BdayCafe, id=cafe_id, submitted_by=request.user)
    except:
        messages.error(request, "등록 정보를 찾을 수 없습니다.")
        return redirect('ddoksang:my_cafes')
    
    context = {
        'cafe': cafe,
    }
    return render(request, 'ddoksang/create_success.html', context)

@require_GET
def cafe_quick_view(request, cafe_id):
    """생일카페 빠른 보기 API"""
    try:
        cafe = BdayCafe.objects.select_related('artist', 'member').get(
            id=cafe_id, status='approved'
        )
        
        data = {
            'success': True,
            'cafe': {
                'id': cafe.id,
                'name': cafe.cafe_name,
                'artist': cafe.artist.display_name,
                'member': cafe.member.member_name if cafe.member else None,
                'start_date': cafe.start_date.strftime('%m월 %d일'),
                'end_date': cafe.end_date.strftime('%m월 %d일'),
                'address': cafe.address,
                'special_benefits': cafe.special_benefits,
                'main_image': cafe.get_main_image(),
                'latitude': float(cafe.latitude) if cafe.latitude else None,
                'longitude': float(cafe.longitude) if cafe.longitude else None,
                'is_active': cafe.is_active,
                'days_remaining': cafe.days_remaining,
            }
        }
        
        return JsonResponse(data)
        
    except BdayCafe.DoesNotExist:
        return JsonResponse({'success': False, 'error': '카페를 찾을 수 없습니다.'})
    except Exception as e:
        # logger.error(f"카페 빠른 보기 오류: {e}")
        return JsonResponse({'success': False, 'error': '서버 오류가 발생했습니다.'})


@require_GET
def bday_cafe_list_api(request):
    """생일카페 목록 API"""
    try:
        page = int(request.GET.get('page', 1))
        limit = int(request.GET.get('limit', DEFAULT_PAGE_SIZE))
        search = request.GET.get('search', '').strip()
        artist_id = request.GET.get('artist_id', '')
        status_filter = request.GET.get('status', 'active')
        sort_by = request.GET.get('sort', 'latest')
        
        # 제한값 검증
        if page < 1 or limit < 1 or limit > 50:
            return JsonResponse({'success': False, 'error': '잘못된 페이징 정보입니다.'})
        
        today = timezone.now().date()
        
        # 기본 쿼리
        cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member')
        
        # 상태별 필터링
        if status_filter == 'active':
            cafes = cafes.filter(start_date__lte=today, end_date__gte=today)
        elif status_filter == 'upcoming':
            cafes = cafes.filter(start_date__gt=today)
        elif status_filter == 'ended':
            cafes = cafes.filter(end_date__lt=today)
        
        # 검색 필터링
        if search:
            cafes = cafes.filter(
                Q(artist__display_name__icontains=search) |
                Q(member__member_name__icontains=search) 
            )
        
        # 아티스트 필터링
        if artist_id:
            cafes = cafes.filter(artist_id=artist_id)
        
        # 정렬
        if sort_by == 'popularity':
            cafes = cafes.order_by('-view_count', '-created_at')
        elif sort_by == 'ending_soon':
            cafes = cafes.filter(end_date__gte=today).order_by('end_date')
        else:  # latest
            cafes = cafes.order_by('-created_at')
        
        # 페이징 처리
        paginator = Paginator(cafes, limit)
        cafes_page = paginator.get_page(page)
        
        # 데이터 직렬화
        cafes_data = []
        for cafe in cafes_page:
            try:
                cafes_data.append({
                    'id': cafe.id,
                    'name': cafe.cafe_name,
                    'artist': cafe.artist.display_name,
                    'member': cafe.member.member_name if cafe.member else None,
                    'start_date': cafe.start_date.strftime('%Y.%m.%d'),
                    'end_date': cafe.end_date.strftime('%Y.%m.%d'),
                    'address': cafe.address,
                    'main_image': cafe.get_main_image(),
                    'is_active': cafe.is_active,
                    'days_remaining': cafe.days_remaining,
                    'view_count': cafe.view_count,
                    'special_benefits': cafe.special_benefits,
                })
            except Exception as e:
                # logger.warning(f"카페 {cafe.id} 데이터 처리 오류: {e}")
                continue
        
        return JsonResponse({
            'success': True,
            'cafes': cafes_data,
            'pagination': {
                'current_page': cafes_page.number,
                'total_pages': paginator.num_pages,
                'has_next': cafes_page.has_next(),
                'has_previous': cafes_page.has_previous(),
                'total_count': paginator.count,
            }
        })
        
    except ValueError as e:
        # logger.warning(f"API 파라미터 오류: {e}")
        return JsonResponse({'success': False, 'error': '잘못된 요청 파라미터입니다.'})
    except Exception as e:
        # logger.error(f"카페 목록 API 오류: {e}")
        return JsonResponse({'success': False, 'error': '서버 오류가 발생했습니다.'})


@require_GET
def nearby_cafes_api(request):
    """주변 생일카페 API"""
    try:
        lat = request.GET.get('lat')
        lng = request.GET.get('lng')
        offset = int(request.GET.get('offset', 0))
        limit = int(request.GET.get('limit', DEFAULT_PAGE_SIZE))
        
        # 좌표 유효성 검증
        is_valid, result = validate_coordinates(lat, lng)
        if not is_valid:
            return JsonResponse({'success': False, 'error': result})
        
        lat, lng = result
        
        # 제한값 검증
        if offset < 0 or limit < 1 or limit > 50:
            return JsonResponse({'success': False, 'error': '잘못된 페이징 정보입니다.'})
        
        # 전체 주변 카페 조회
        all_nearby = get_nearby_cafes(lat, lng, radius_km=10, limit=MAX_NEARBY_CAFES)
        
        # 페이징 처리
        paginated_cafes = all_nearby[offset:offset + limit]
        
        cafes_data = []
        for cafe in paginated_cafes:
            try:
                cafes_data.append({
                    'id': cafe.id,
                    'name': cafe.cafe_name,
                    'artist': cafe.artist.display_name,
                    'member': cafe.member.member_name if cafe.member else None,
                    'distance': round(cafe.distance, 1),
                    'duration': cafe.duration,
                    'main_image': cafe.get_main_image(),
                    'start_date': cafe.start_date.strftime('%m.%d'),
                    'end_date': cafe.end_date.strftime('%m.%d'),
                    'is_active': cafe.is_active,
                    'days_remaining': cafe.days_remaining,
                    'special_benefits': cafe.special_benefits,
                })
            except Exception as e:
                # logger.warning(f"카페 {cafe.id} 데이터 처리 오류: {e}")
                continue
        
        return JsonResponse({
            'success': True,
            'cafes': cafes_data,
            'has_more': len(all_nearby) > offset + limit,
            'total': len(all_nearby)
        })
        
    except ValueError as e:
        # logger.warning(f"API 파라미터 오류: {e}")
        return JsonResponse({'success': False, 'error': '잘못된 요청 파라미터입니다.'})
    except Exception as e:
        # logger.error(f"주변 카페 API 오류: {e}")
        return JsonResponse({'success': False, 'error': '서버 오류가 발생했습니다.'})


@require_GET
def member_autocomplete(request):
    q = request.GET.get('q', '').strip()
    seen_pairs = set()
    results = []

    if len(q) >= 1:
        try:
            members = Member.objects.filter(
                Q(member_name__icontains=q)
            ).prefetch_related('artist_name')[:50]

            for member in members:
                for artist in member.artist_name.all():
                    pair_key = (member.id, artist.id)
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    # 정확도 점수 계산: 정확히 일치하면 높은 점수 부여
                    exact_match = (member.member_name == q)
                    results.append({
                        'member_id': member.id,
                        'artist_id': artist.id,
                        'member_name': member.member_name,
                        'artist_display': artist.display_name,
                        'bday': member.member_bday,
                        'priority': 1 if exact_match else 2
                    })
        except Exception as e:
            logger.error(f"[Autocomplete] 멤버 검색 오류: {e}")

    # 🔽 정확한 일치가 위에 오도록 정렬
    results.sort(key=lambda x: (x['priority'], x['member_name']))
    return JsonResponse({'results': results})





def home_view(request):
    """홈 뷰 - 위치 기반 서비스 포함"""
    today = timezone.now().date()
    
    # 이번 주 생일 아티스트들
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    week_bdays = [(start_of_week + timedelta(days=i)).strftime('%m-%d') for i in range(7)]
    
     # 오늘 날짜 문자열
    today_str = today.strftime('%m-%d')
    
    # 생일인 멤버들과 그들의 아티스트 정보
    birthday_members = Member.objects.filter(
        member_bday__in=week_bdays
    ).select_related().prefetch_related('artist_name')
    
    birthday_artists = []
    for member in birthday_members:
        artists = member.artist_name.all()
        if artists:
            artist = artists[0]
            
            # 오늘이 생일인지 확인
            is_today_birthday = member.member_bday == today_str
            
            # 중복 방지: 멤버 이름과 아티스트 이름이 같은 경우 처리
            display_artist_name = artist.display_name
            if member.member_name.lower() == artist.display_name.lower():
                # 멤버 이름과 아티스트 이름이 같으면 아티스트 이름을 비워두거나 다른 표현 사용
                display_artist_name = ""  # 또는 "솔로 아티스트" 등
            
            birthday_artists.append({
                'member_name': member.member_name,
                'artist_name': display_artist_name,  # 🔥 수정된 부분
                'birthday_display': member.member_bday,
                'profile_image': getattr(member, 'profile_image', None),
                'is_today_birthday': is_today_birthday,
            })
    
    # 오늘이 생일인 사람을 맨 앞으로 정렬
    birthday_artists.sort(key=lambda x: (not x['is_today_birthday'], x['member_name']))
   
    # 🔧 최신 등록된 카페 3개 (별도 섹션)
    latest_cafes = cache.get('latest_cafes')
    if not latest_cafes:
        latest_cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member').prefetch_related('images').order_by('-created_at')[:3]
        cache.set('latest_cafes', latest_cafes, 300)  # 5분 캐시
    
    # 🔧 내가 찜한 아티스트/멤버의 생일카페 (로그인한 사용자만)
    my_favorite_cafes = []
    if request.user.is_authenticated:
        # 사용자가 찜한 카페들의 아티스트/멤버 ID 수집
        favorited_cafes = CafeFavorite.objects.filter(user=request.user).select_related('cafe__artist', 'cafe__member')
        
        favorited_artist_ids = set()
        favorited_member_ids = set()
        
        for fav in favorited_cafes:
            if fav.cafe.artist_id:
                favorited_artist_ids.add(fav.cafe.artist_id)
            if fav.cafe.member_id:
                favorited_member_ids.add(fav.cafe.member_id)
        
        # 찜한 아티스트/멤버의 다른 생일카페들 조회
        if favorited_artist_ids or favorited_member_ids:
            my_favorite_cafes_query = BdayCafe.objects.filter(
                status='approved'
            ).select_related('artist', 'member').prefetch_related('images')
            
            if favorited_artist_ids and favorited_member_ids:
                my_favorite_cafes_query = my_favorite_cafes_query.filter(
                    Q(artist_id__in=favorited_artist_ids) | Q(member_id__in=favorited_member_ids)
                )
            elif favorited_artist_ids:
                my_favorite_cafes_query = my_favorite_cafes_query.filter(artist_id__in=favorited_artist_ids)
            elif favorited_member_ids:
                my_favorite_cafes_query = my_favorite_cafes_query.filter(member_id__in=favorited_member_ids)
            
            my_favorite_cafes = my_favorite_cafes_query.order_by('-created_at')[:10]
    
    # 현재 운영중인 생일카페들 (위치 기반 서비스용)
    active_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member').prefetch_related('images')
    
    # 안전한 지도 데이터 생성 (개선된 버전)
    cafes_json_data = []
    for cafe in active_cafes:
        try:
            # 메인 이미지 가져오기 (다중 이미지 시스템 우선)
            main_image_url = cafe.get_main_image()
            
            cafe_data = {
                'id': cafe.id,
                'name': cafe.cafe_name,
                'artist': cafe.artist.display_name,
                'member': cafe.member.member_name if cafe.member else None,
                'latitude': float(cafe.latitude) if cafe.latitude else None,
                'longitude': float(cafe.longitude) if cafe.longitude else None,
                'address': cafe.address or '',
                'road_address': cafe.road_address or '',
                'start_date': cafe.start_date.strftime('%Y-%m-%d'),
                'end_date': cafe.end_date.strftime('%Y-%m-%d'),
                'is_active': cafe.is_active,
                'days_remaining': cafe.days_remaining,
                'main_image': main_image_url,
                'special_benefits': cafe.special_benefits or '',
                'cafe_type': cafe.get_cafe_type_display(),
            }
            
            # 좌표가 유효한 경우만 추가
            if (cafe_data['latitude'] and cafe_data['longitude'] and 
                isinstance(cafe_data['latitude'], (int, float)) and 
                isinstance(cafe_data['longitude'], (int, float))):
                cafes_json_data.append(cafe_data)
                
        except (AttributeError, ValueError, TypeError) as e:
            logger.warning(f"카페 {cafe.id} 지도 데이터 생성 오류: {e}")
            continue
    
    cafes_json = json.dumps(cafes_json_data, ensure_ascii=False)
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)

    context = {
        'birthday_artists': birthday_artists,
        'latest_cafes': latest_cafes,  # 🔧 새로 추가
        'my_favorite_cafes': my_favorite_cafes,  # 🔧 새로 추가
        'cafes_json': cafes_json,
        'total_cafes': len(cafes_json_data),
        'user_favorites': user_favorites,
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/home.html', context)

@cache_page(60 * 15)  # 15분 캐시
def map_view(request):
    """지도 뷰 (클러스터링 지원)"""
    today = timezone.now().date()
    
    # 현재 운영중인 생일카페들
    active_bday_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('artist', 'member')
    
    # 예정된 카페들도 포함
    upcoming_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__gt=today
    ).select_related('artist', 'member')
    
    # 두 쿼리셋 합치기
    all_active_cafes = active_bday_cafes.union(upcoming_cafes)
    
    # 안전한 지도 데이터 생성
    bday_cafe_data = get_safe_cafe_map_data(all_active_cafes)
    
    context = {
        'bday_cafes_json': json.dumps(bday_cafe_data, ensure_ascii=False),
        'total_bday_cafes': len(bday_cafe_data),
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/tour_map.html', context)

def cafe_list_view(request):
    """카페 목록 페이지"""
    page = request.GET.get('page', 1)
    search = request.GET.get('search', '')
    artist_filter = request.GET.get('artist', '')
    status_filter = request.GET.get('status', 'active')  # active, all, upcoming, ended
    sort_by = request.GET.get('sort', 'latest')  # latest, popularity, distance
    
    today = timezone.now().date()
    
    # 기본 쿼리
    cafes = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member')
    
    # 상태별 필터링
    if status_filter == 'active':
        cafes = cafes.filter(start_date__lte=today, end_date__gte=today)
    elif status_filter == 'upcoming':
        cafes = cafes.filter(start_date__gt=today)
    elif status_filter == 'ended':
        cafes = cafes.filter(end_date__lt=today)
    # 'all'인 경우 필터링하지 않음
    
    # 검색 필터링 (수정됨 - 아티스트/멤버만)
    if search:
        cafes = cafes.filter(
            Q(artist__display_name__icontains=search) |
            Q(member__member_name__icontains=search)
        )
        
    # 아티스트 필터링
    if artist_filter:
        cafes = cafes.filter(artist_id=artist_filter)
    
    # 정렬
    if sort_by == 'popularity':
        cafes = cafes.order_by('-view_count', '-created_at')
    elif sort_by == 'ending_soon':
        cafes = cafes.filter(end_date__gte=today).order_by('end_date')
    else:  # latest
        cafes = cafes.order_by('-created_at')
    
    # 페이징 처리
    paginator = Paginator(cafes, 12)
    cafes_page = paginator.get_page(page)
    
    # 아티스트 목록 (필터용)
    artists = Artist.objects.filter(
        bdaycafe__status='approved'
    ).distinct().order_by('display_name')
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'cafes': cafes_page,
        'artists': artists,
        'user_favorites': user_favorites,
        'search': search,
        'artist_filter': artist_filter,
        'status_filter': status_filter,
        'sort_by': sort_by,
        'total_count': paginator.count,
    }
    return render(request, 'ddoksang/cafe_list.html', context)


def search_view(request):
    """통합 검색 페이지"""
    query = request.GET.get('q', '').strip()
    page = request.GET.get('page', 1)
    
    results = []
    total_count = 0
    
    if query and len(query) >= 2:
        # 검색 기록 저장 (로그인한 사용자만)
        if request.user.is_authenticated:
            UserSearchHistory.objects.create(
                user=request.user,
                search_query=query
            )
        
        # 카페 검색 - 아티스트/멤버만
        cafes = BdayCafe.objects.filter(
            Q(artist__display_name__icontains=query) |
            Q(member__member_name__icontains=query),
            status='approved'
        ).select_related('artist', 'member').distinct()
        
        # 페이징 처리
        paginator = Paginator(cafes, 10)
        results = paginator.get_page(page)
        total_count = paginator.count
    
    # 사용자 찜 목록
    user_favorites = get_user_favorites(request.user)
    
    context = {
        'results': results,
        'query': query,
        'total_count': total_count,
        'user_favorites': user_favorites,
    }
    return render(request, 'ddoksang/search.html', context)

# === 사용자 뷰 ===
@login_required
def my_cafes(request):
    """사용자가 등록한 카페 목록"""
    page = request.GET.get('page', 1)
    status_filter = request.GET.get('status', '')
    
    # 사용자가 등록한 카페들
    cafes = BdayCafe.objects.filter(
        submitted_by=request.user
    ).select_related('artist', 'member').order_by('-created_at')
    
    # 상태별 필터링
    if status_filter:
        cafes = cafes.filter(status=status_filter)
    
    # 페이징 처리
    paginator = Paginator(cafes, 10)
    cafes_page = paginator.get_page(page)
    
    # 통계 정보
    stats = {
        'total': BdayCafe.objects.filter(submitted_by=request.user).count(),
        'pending': BdayCafe.objects.filter(submitted_by=request.user, status='pending').count(),
        'approved': BdayCafe.objects.filter(submitted_by=request.user, status='approved').count(),
        'rejected': BdayCafe.objects.filter(submitted_by=request.user, status='rejected').count(),
    }
    
    context = {
        'cafes': cafes_page,
        'stats': stats,
        'status_filter': status_filter,
        'status_choices': BdayCafe.STATUS_CHOICES,
    }
    return render(request, 'ddoksang/my_cafes.html', context)


@login_required
def create_view(request):
    """카페 등록 폼 페이지"""
    form = BdayCafeForm()
    image_form = BdayCafeImageForm()
    
    # 아티스트 목록
    artists = Artist.objects.all().order_by('display_name')
    
    context = {
        'form': form,
        'image_form': image_form,
        'artists': artists,
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/create.html', context)


@login_required
@require_POST
def toggle_favorite(request, cafe_id):
    """카페 찜하기/찜해제 토글"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id, status='approved')
        favorite, created = CafeFavorite.objects.get_or_create(
            user=request.user,
            cafe=cafe
        )
        
        if not created:
            favorite.delete()
            is_favorited = False
            message = "찜이 해제되었습니다."
        else:
            is_favorited = True
            message = "찜 목록에 추가되었습니다."
        
        return JsonResponse({
            'success': True,
            'is_favorited': is_favorited,
            'message': message
        })
        
    except Exception as e:
        # logger.error(f"찜하기 토글 오류: {e}")
        return JsonResponse({
            'success': False,
            'error': '오류가 발생했습니다.'
        })




@login_required
def favorites_view(request):
    """찜한 카페 목록"""
    page = request.GET.get('page', 1)
    
    # 사용자가 찜한 카페들
    favorites = CafeFavorite.objects.filter(
        user=request.user
    ).select_related('cafe__artist', 'cafe__member').order_by('-created_at')
    
    # 페이징 처리
    paginator = Paginator(favorites, 12)
    favorites_page = paginator.get_page(page)
    
    context = {
        'favorites': favorites_page,
        'total_count': favorites.count(),
    }
    return render(request, 'ddoksang/favorites.html', context)


# === 관리자 뷰 ===
@admin_required
def admin_dashboard(request):
    """관리자 대시보드"""
    # 통계 데이터 캐싱
    stats = cache.get('admin_stats')
    if not stats:
        stats = {
            'pending': BdayCafe.objects.filter(status='pending').count(),
            'approved': BdayCafe.objects.filter(status='approved').count(),
            'rejected': BdayCafe.objects.filter(status='rejected').count(),
            'total': BdayCafe.objects.count(),
            'this_month': BdayCafe.objects.filter(
                created_at__year=timezone.now().year,
                created_at__month=timezone.now().month
            ).count(),
        }
        cache.set('admin_stats', stats, 300)  # 5분 캐시
    
    # 최근 카페들 (5개)
    recent_cafes = BdayCafe.objects.select_related(
        'artist', 'member', 'submitted_by'
    ).order_by('-created_at')[:5]
    
    # 승인 대기중인 카페들 (10개)
    pending_cafes = BdayCafe.objects.filter(status='pending').select_related(
        'artist', 'member', 'submitted_by'
    ).order_by('created_at')[:10]
    
    # 최근 거절된 카페들 (3개) - 선택사항
    rejected_cafes = BdayCafe.objects.filter(status='rejected').select_related(
        'artist', 'member', 'submitted_by'
    ).order_by('-created_at')[:3]

    return render(request, 'admin/ddoksang/dashboard.html', {
        'stats': stats,
        'recent_cafes': recent_cafes,
        'pending_cafes': pending_cafes,
        'rejected_cafes': rejected_cafes,
    })

@admin_required
def admin_cafe_list(request):
    """관리자 카페 목록"""
    status_filter = request.GET.get('status', '')
    page = request.GET.get('page', 1)
    
    cafes = BdayCafe.objects.select_related('artist', 'member', 'submitted_by').order_by('-created_at')
    
    if status_filter:
        cafes = cafes.filter(status=status_filter)
    
    # 페이징 처리
    paginator = Paginator(cafes, 20)
    cafes_page = paginator.get_page(page)
    
    context = {
        'cafes': cafes_page,
        'status_filter': status_filter,
        'status_choices': BdayCafe.STATUS_CHOICES,
    }
    return render(request, 'admin/ddoksang/cafe_list.html', context)


@admin_required
@require_POST
def approve_cafe(request, cafe_id):
    """카페 승인"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id)
        cafe.status = 'approved'
        cafe.verified_at = timezone.now()
        cafe.verified_by = request.user
        cafe.save()
        
        # 관련 캐시 무효화
        cache.delete_many([
            'admin_stats',
            'featured_cafes',
            'recent_cafes',
        ])
        
        messages.success(request, f"'{cafe.cafe_name}' 생카가 승인되었습니다.")
        # logger.info(f"카페 승인: {cafe.id} by {request.user.username}")
        
    except Exception as e:
        # logger.error(f"카페 승인 오류: {e}")
        messages.error(request, "승인 처리 중 오류가 발생했습니다.")
    
    # 이전 페이지로 돌아가기 (대시보드 또는 카페 목록)
    next_url = request.GET.get('next')
    if next_url and next_url in ['dashboard', 'cafe_list']:
        if next_url == 'dashboard':
            return redirect('ddoksang:admin_dashboard')
        else:
            return redirect('ddoksang:admin_cafe_list')
    return redirect('ddoksang:admin_dashboard')


@admin_required
@require_POST
def reject_cafe(request, cafe_id):
    """카페 거절"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id)
        cafe.status = 'rejected'
        cafe.verified_at = timezone.now()
        cafe.verified_by = request.user
        cafe.save()
        
        # 관련 캐시 무효화
        cache.delete('admin_stats')
        
        messages.success(request, f"'{cafe.cafe_name}' 생카가 거절되었습니다.")
        # logger.info(f"카페 거절: {cafe.id} by {request.user.username}")
        
    except Exception as e:
        # logger.error(f"카페 거절 오류: {e}")
        messages.error(request, "거절 처리 중 오류가 발생했습니다.")
    
    # 이전 페이지로 돌아가기 (대시보드 또는 카페 목록)
    next_url = request.GET.get('next')
    if next_url and next_url in ['dashboard', 'cafe_list']:
        if next_url == 'dashboard':
            return redirect('ddoksang:admin_dashboard')
        else:
            return redirect('ddoksang:admin_cafe_list')
    return redirect('ddoksang:admin_dashboard')


# 관리자 승인 전 관리자/ 사용자의 덕생 추가 글에 대한 미리보기 기능

# def preview_cafe(request, cafe_id):
#     cafe = get_object_or_404(BdayCafe, id=cafe_id)
#     is_admin = request.GET.get("admin") == "1"
#     context = {
#         "cafe": cafe,
#         "is_admin_preview": is_admin,
#         "kakao_api_key": getattr(settings, 'KAKAO_MAP_API_KEY', ''),  # 기존과 동일하게 유지
#     }
#     return render(request, "ddoksang/cafe_preview.html", context)

@login_required
def user_preview_cafe(request, cafe_id):
    """사용자 미리보기 (자신이 등록한 카페만, 상태 무관)"""
    cafe = get_object_or_404(BdayCafe, id=cafe_id, submitted_by=request.user)
    
    context = {
        'cafe': cafe,
        'is_favorited': False,
        'nearby_cafes': [],
        'user_favorites': [],
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        'is_preview': True,
        'can_edit': True,
        'preview_type': 'user',
    }
    return render(request, 'ddoksang/detail.html', context)

@admin_required
def admin_preview_cafe(request, cafe_id):
    """관리자 미리보기 (모든 카페, 상태 무관)"""
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    
    context = {
        'cafe': cafe,
        'is_favorited': False,
        'nearby_cafes': [],
        'user_favorites': [],
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
        'is_preview': True,
        'can_edit': False,
        'preview_type': 'admin',
    }
    return render(request, 'ddoksang/detail.html', context)