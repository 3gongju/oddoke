# API 뷰들 - map_utils 사용으로 중복 제거

from datetime import date
import logging
from django.contrib.auth.decorators import login_required
from arrow import now
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET
from django.core.paginator import Paginator
from django.utils import timezone
from django.db.models import Q
from django.template.loader import render_to_string
from django.conf import settings
from difflib import SequenceMatcher

from django.http import JsonResponse
from difflib import SequenceMatcher
from ddoksang.models import BdayCafe

from ddoksang.models import BdayCafe, CafeFavorite
from ddoksang.utils.map_utils import (
    serialize_cafe_for_map, 
    get_nearby_cafes, 
    filter_operating_cafes,
    is_valid_coordinates
)
from ddoksang.views.decorators import admin_required

logger = logging.getLogger(__name__)

DEFAULT_PAGE_SIZE = getattr(settings, 'DEFAULT_PAGE_SIZE', 10)
MAX_NEARBY_CAFES = getattr(settings, 'MAX_NEARBY_CAFES', 20)


@require_GET
def bday_cafe_list_api(request):
    """현재 운영중인 생일카페 목록 API"""
    try:
        # 현재 운영중인 카페들만 가져오기
        cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member').prefetch_related('images')
        operating_cafes = filter_operating_cafes(cafes)
        
        # map_utils의 serialize 함수 사용
        data = []
        for cafe in operating_cafes:
            cafe_data = serialize_cafe_for_map(cafe)
            if cafe_data:
                data.append(cafe_data)
        
        return JsonResponse({
            'success': True, 
            'cafes': data, 
            'total': len(data)
        })
        
    except Exception as e:
        logger.error(f"카페 목록 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_GET
def cafe_quick_view(request, cafe_id):
    """카페 빠른 조회 API (모달용)"""
    try:
        cafe = get_object_or_404(
            BdayCafe.objects.select_related('artist', 'member').prefetch_related('images'), 
            id=cafe_id, 
            status='approved'
        )
        
        # map_utils의 serialize 함수 사용하고 추가 정보 포함
        data = serialize_cafe_for_map(cafe)
        if data:
            data.update({
                'road_address': cafe.road_address,
                'hashtags': cafe.hashtags,
                'event_description': cafe.event_description,
                'cafe_type_display': cafe.get_cafe_type_display(),
                'days_remaining': cafe.days_remaining,
                'days_until_start': cafe.days_until_start,
            })
        
        return JsonResponse({'success': True, 'cafe': data})
        
    except Exception as e:
        logger.error(f"카페 빠른 조회 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_GET
def nearby_cafes_api(request):
    """주변 카페 검색 API"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        radius_km = int(request.GET.get('radius', 3000)) / 1000  # 미터를 킬로미터로 변환
        
        if not is_valid_coordinates(lat, lng):
            return JsonResponse({'success': False, 'error': '유효하지 않은 좌표입니다.'}, status=400)
        
        # 현재 운영중인 카페들만 검색
        cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member')
        operating_cafes = filter_operating_cafes(cafes)
        
        # map_utils의 get_nearby_cafes 함수 사용
        nearby_cafes = get_nearby_cafes(
            user_lat=lat,
            user_lng=lng,
            cafes_queryset=operating_cafes,
            radius_km=radius_km,
            limit=MAX_NEARBY_CAFES
        )
        
        return JsonResponse({
            'success': True, 
            'cafes': nearby_cafes, 
            'radius': radius_km * 1000,  # 다시 미터로 변환해서 응답
            'user_location': {'lat': lat, 'lng': lng}
        })
        
    except (ValueError, TypeError) as e:
        logger.error(f"주변 카페 API 파라미터 오류: {e}")
        return JsonResponse({'success': False, 'error': '잘못된 파라미터입니다.'}, status=400)
    except Exception as e:
        logger.error(f"주변 카페 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_GET
def cafe_map_data_api(request):
    """지도용 카페 데이터 API"""
    try:
        # 현재 운영중인 카페들만
        cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member')
        operating_cafes = filter_operating_cafes(cafes)
        
        # map_utils의 serialize 함수 사용
        data = []
        for cafe in operating_cafes:
            cafe_data = serialize_cafe_for_map(cafe)
            if cafe_data:
                data.append(cafe_data)
        
        return JsonResponse({
            'success': True, 
            'cafes': data, 
            'total': len(data),
            'generated_at': timezone.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"지도 데이터 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_GET
def search_suggestions_api(request):
    """검색 자동완성 API"""
    try:
        q = request.GET.get('q', '').strip()
        if len(q) < 2:
            return JsonResponse({'success': True, 'suggestions': []})
        
        # 승인된 카페에서 아티스트/멤버명으로 검색
        cafes = BdayCafe.objects.filter(
            Q(artist__display_name__icontains=q) | Q(member__member_name__icontains=q), 
            status='approved'
        ).select_related('artist', 'member')[:10]
        
        suggestions = []
        for cafe in cafes:
            suggestions.append({
                'id': cafe.id,
                'cafe_name': cafe.cafe_name,
                'artist_name': cafe.artist.display_name if cafe.artist else '',
                'member_name': cafe.member.member_name if cafe.member else '',
                'address': cafe.address,
                'is_active': cafe.is_active,
            })
        
        return JsonResponse({'success': True, 'suggestions': suggestions})
        
    except Exception as e:
        logger.error(f"검색 자동완성 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_GET
def latest_cafes_api(request):
    """최신 카페 목록 API (더보기 기능용)"""
    try:
        page = int(request.GET.get('page', 1))
        per_page = 6

        # 승인된 모든 카페 (운영 상태 무관)
        cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member').prefetch_related('images').order_by('-created_at')

        paginator = Paginator(cafes, per_page)
        page_obj = paginator.get_page(page)

        # 사용자 찜 목록
        user_favorites = []
        if request.user.is_authenticated:
            user_favorites = list(
                CafeFavorite.objects.filter(user=request.user)
                .values_list('cafe_id', flat=True)
            )

        # 템플릿 렌더링
        html_content = ""
        for cafe in page_obj:
            cafe_html = render_to_string('ddoksang/components/_cafe_card_base.html', {
                'cafe': cafe,
                'card_variant': 'latest',
                'user_favorites': user_favorites,
                'user': request.user,
            }, request=request)
            html_content += f'<div class="cafe-card-item w-full max-w-[175px] md:max-w-none">{cafe_html}</div>'

        return JsonResponse({
            'success': True,
            'html': html_content,
            'has_next': page_obj.has_next(),
            'next_page_number': page_obj.next_page_number() if page_obj.has_next() else None,
            'total_pages': paginator.num_pages,
            'current_page': page_obj.number,
            'total_count': paginator.count,
            'cafes_count': len(page_obj),
        })
        
    except ValueError as e:
        logger.error(f"Latest cafes API 파라미터 오류: {e}")
        return JsonResponse({'success': False, 'error': '잘못된 페이지 번호입니다.'}, status=400)
    except Exception as e:
        logger.error(f"Latest cafes API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


#  추가: 카페 상세 정보 API (모달용)
@require_GET
def cafe_detail_api(request, cafe_id):
    """카페 상세 정보 API (모달 전용)"""
    try:
        cafe = get_object_or_404(
            BdayCafe.objects.select_related('artist', 'member').prefetch_related('images'),
            id=cafe_id,
            status='approved'
        )
        
        # 기본 정보
        data = serialize_cafe_for_map(cafe)
        if not data:
            return JsonResponse({'success': False, 'error': '카페 정보 처리 실패'}, status=500)
        
        # 상세 정보 추가
        data.update({
            'road_address': cafe.road_address,
            'phone': getattr(cafe, 'phone', ''),
            'website': getattr(cafe, 'website', ''),
            'hashtags': cafe.hashtags,
            'hashtags_list': cafe.hashtags.split('#') if cafe.hashtags else [],
            'cafe_type_display': cafe.get_cafe_type_display(),
            'days_remaining': cafe.days_remaining,
            'days_until_start': cafe.days_until_start,
            'special_benefits_list': cafe.special_benefits.split(',') if cafe.special_benefits else [],
            
            # 이미지 목록
            'images': [
                {
                    'url': img.image.url,
                    'type': img.image_type,
                    'is_main': img.is_main,
                    'caption': getattr(img, 'caption', ''),
                } for img in cafe.images.all()
            ] if hasattr(cafe, 'images') else [],
        })
        
        # 찜 상태 (로그인된 사용자만)
        is_favorited = False
        if request.user.is_authenticated:
            is_favorited = CafeFavorite.objects.filter(
                user=request.user, 
                cafe=cafe
            ).exists()
        
        data['is_favorited'] = is_favorited
        
        return JsonResponse({'success': True, 'cafe': data})
        
    except Exception as e:
        logger.error(f"카페 상세 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    


def normalize(text):
    return ''.join(text.lower().split())

@require_GET
def check_duplicate_cafe(request):
    """
    생일카페 중복 확인 API
    GET /ddoksang/cafe/check-duplicate/?artist_id=X&member_id=Y&cafe_name=Z&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
    """
    try:
        artist_id = request.GET.get('artist_id')
        member_id = request.GET.get('member_id', '')
        cafe_name = request.GET.get('cafe_name', '').strip()
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        # 필수 파라미터 체크
        if not all([artist_id, cafe_name, start_date, end_date]):
            return JsonResponse({
                'exists': False,
                'error': '필수 파라미터가 누락되었습니다.'
            })
        
        # 날짜 변환
        try:
            from datetime import datetime
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({
                'exists': False,
                'error': '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'
            })
        
        from django.db.models import Q
        from difflib import SequenceMatcher
        
        # 기본 필터: 같은 아티스트 + 기간 겹침
        filters = {
            'artist_id': artist_id,
            # 'start_date__lte': end_date_obj,  # 시작일이 검사 종료일 이전
            # 'end_date__gte': start_date_obj,  # 종료일이 검사 시작일 이후 (기간 겹침)
            'start_date': start_date_obj,
            'end_date': end_date_obj,
        }
        
        # 삭제되지 않은 카페만 (is_deleted 필드가 있는 경우)
        if hasattr(BdayCafe, 'is_deleted'):
            filters['is_deleted'] = False
        ㅔ
        # 멤버가 지정된 경우 추가
        if member_id:
            filters['member_id'] = member_id
        
        # 해당 조건의 카페들 조회
        existing_cafes = BdayCafe.objects.filter(**filters)
        
        # 카페명 유사성 검사
        def normalize_name(name):
            """이름 정규화: 공백 제거, 소문자 변환"""
            return ''.join(name.lower().split())
        
        normalized_input_name = normalize_name(cafe_name)
        
        # 유사한 이름의 카페 찾기
        similar_cafes = []
        similarity_threshold = 0.75  # 75% 이상 유사하면 중복으로 간주
        
        for cafe in existing_cafes:
            normalized_existing_name = normalize_name(cafe.cafe_name)
            
            # 1. 완전 일치 확인
            if normalized_input_name == normalized_existing_name:
                similar_cafes.append(cafe)
                continue
            
            #  단어를 포함할 경우 같은 카페라고 인식할 확률이 높아 주석처리로 삭제    
            # 2. 포함 관계 확인 (한 쪽이 다른 쪽을 포함)
            # if (normalized_input_name in normalized_existing_name or 
            #     normalized_existing_name in normalized_input_name):
            #     similar_cafes.append(cafe)
            #     continue
                
            # 3. 유사도 확인
            similarity = SequenceMatcher(None, normalized_input_name, normalized_existing_name).ratio()
            if similarity >= similarity_threshold:
                similar_cafes.append(cafe)
        
        # 결과 반환
        exists = len(similar_cafes) > 0
        
        result = {
            'exists': exists,
            'message': '유사한 생일카페가 발견되었습니다.' if exists else '중복되지 않습니다.'
        }
        
        
        logger.info(f"중복 확인: {cafe_name} ({'중복' if exists else '신규'})")
        return JsonResponse(result)
        
    except Exception as e:
        logger.error(f"중복 확인 API 오류: {e}")
        return JsonResponse({
            'exists': False,
            'error': f'서버 오류가 발생했습니다: {str(e)}'
        }, status=500)