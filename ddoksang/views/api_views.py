# API 엔드포인트들

from datetime import date
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET
from django.core.paginator import Paginator
from django.utils import timezone
from django.db.models import Q
import logging

from ..models import BdayCafe
from .utils import DEFAULT_PAGE_SIZE, validate_coordinates, get_nearby_cafes

logger = logging.getLogger(__name__)


def cafe_quick_view(request, cafe_id):
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id, status='approved')
        data = {
            'success': True,
            'cafe': {
                'id': cafe.id,
                'name': cafe.cafe_name,
                'artist': cafe.artist.display_name,
                'member': cafe.member.member_name if cafe.member else '',
                'start_date': cafe.start_date.strftime('%m.%d'),
                'end_date': cafe.end_date.strftime('%m.%d'),
                'address': cafe.address or '',
                'main_image': cafe.get_main_image() if hasattr(cafe, 'get_main_image') else '',
                'is_active': cafe.start_date <= date.today() <= cafe.end_date,
            }
        }
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

        
    except BdayCafe.DoesNotExist:
        return JsonResponse({'success': False, 'error': '카페를 찾을 수 없습니다.'})
    except Exception as e:
        logger.error(f"카페 빠른 보기 오류: {e}")
        return JsonResponse({'success': False, 'error': '서버 오류가 발생했습니다.'})

@require_GET
@require_GET
def bday_cafe_list_api(request):
    """생일카페 목록 API (새 게시물 체크 기능 추가)"""
    try:
        page = int(request.GET.get('page', 1))
        limit = int(request.GET.get('limit', DEFAULT_PAGE_SIZE))
        search = request.GET.get('search', '').strip()
        artist_id = request.GET.get('artist_id', '')
        status_filter = request.GET.get('status', 'active')
        sort_by = request.GET.get('sort', 'latest')
        
        # ✅ 새 게시물 체크를 위한 추가 파라미터
        since_param = request.GET.get('since', '').strip()
        check_new_only = request.GET.get('check_new_only', 'false').lower() == 'true'
        
        # 제한값 검증
        if page < 1 or limit < 1 or limit > 50:
            return JsonResponse({'success': False, 'error': '잘못된 페이징 정보입니다.'})
        
        today = timezone.now().date()
        
        # ✅ 새 게시물만 체크하는 경우 (경량 응답)
        if check_new_only and since_param:
            try:
                from datetime import datetime
                since_time = datetime.fromisoformat(since_param.replace('Z', '+00:00'))
                
                new_cafes_count = BdayCafe.objects.filter(
                    status='approved',
                    created_at__gt=since_time
                ).count()
                
                return JsonResponse({
                    'success': True,
                    'new_posts_count': new_cafes_count,
                    'has_new_posts': new_cafes_count > 0,
                    'current_time': timezone.now().isoformat(),
                    'since': since_time.isoformat()
                })
                
            except ValueError:
                return JsonResponse({'success': False, 'error': '잘못된 날짜 형식입니다.'})
        
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
                    'created_at': cafe.created_at.isoformat(),  # ✅ 추가
                })
            except Exception as e:
                logger.warning(f"카페 {cafe.id} 데이터 처리 오류: {e}")
                continue
        
        # ✅ 기본 응답 데이터
        response_data = {
            'success': True,
            'cafes': cafes_data,
            'pagination': {
                'current_page': cafes_page.number,
                'total_pages': paginator.num_pages,
                'has_next': cafes_page.has_next(),
                'has_previous': cafes_page.has_previous(),
                'total_count': paginator.count,
            },
            'current_time': timezone.now().isoformat()  # ✅ 추가
        }
        
        # ✅ since 파라미터가 있으면 새 게시물 정보도 포함
        if since_param:
            try:
                from datetime import datetime
                since_time = datetime.fromisoformat(since_param.replace('Z', '+00:00'))
                
                # since_time 이후 새로 생성된 카페 수
                new_cafes_count = BdayCafe.objects.filter(
                    status='approved',
                    created_at__gt=since_time
                ).count()
                
                response_data.update({
                    'new_posts_count': new_cafes_count,
                    'has_new_posts': new_cafes_count > 0,
                    'since': since_time.isoformat()
                })
                
            except ValueError:
                # 잘못된 날짜 형식이면 무시
                pass
        
        return JsonResponse(response_data)
        
    except ValueError as e:
        logger.warning(f"API 파라미터 오류: {e}")
        return JsonResponse({'success': False, 'error': '잘못된 요청 파라미터입니다.'})
    except Exception as e:
        logger.error(f"카페 목록 API 오류: {e}")
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
        from .utils import MAX_NEARBY_CAFES
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
                logger.warning(f"카페 {cafe.id} 데이터 처리 오류: {e}")
                continue
        
        return JsonResponse({
            'success': True,
            'cafes': cafes_data,
            'has_more': len(all_nearby) > offset + limit,
            'total': len(all_nearby)
        })
        
    except ValueError as e:
        logger.warning(f"API 파라미터 오류: {e}")
        return JsonResponse({'success': False, 'error': '잘못된 요청 파라미터입니다.'})
    except Exception as e:
        logger.error(f"주변 카페 API 오류: {e}")
        return JsonResponse({'success': False, 'error': '서버 오류가 발생했습니다.'})

# 지도 데이터 API
@require_GET  
def cafe_map_data_api(request):
    """카페 지도 데이터 API"""
    try:
        # 승인된 카페만 가져오기
        cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member')
        
        map_data = []
        for cafe in cafes:
            cafe_data = cafe.get_kakao_map_data()
            if cafe_data:  # 유효한 좌표가 있는 경우만
                map_data.append(cafe_data)
        
        return JsonResponse({
            'success': True,
            'data': map_data,
            'count': len(map_data)
        })
        
    except Exception as e:
        logger.error(f"지도 데이터 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# 검색 자동완성 API
@require_GET
def search_suggestions_api(request):
    """검색 자동완성 API"""
    try:
        query = request.GET.get('q', '').strip()
        
        if len(query) < 2:
            return JsonResponse({'success': True, 'suggestions': []})
        
        # 아티스트 검색
        suggestions = []
        
        # 아티스트명 검색
        artist_cafes = BdayCafe.objects.filter(
            artist__display_name__icontains=query,
            status='approved'
        ).values_list('artist__display_name', flat=True).distinct()[:5]
        
        for artist in artist_cafes:
            suggestions.append({
                'type': 'artist',
                'text': artist,
                'label': f'아티스트: {artist}'
            })
        

        return JsonResponse({
            'success': True,
            'suggestions': suggestions[:10]  # 최대 10개
        })
        
    except Exception as e:
        logger.error(f"검색 자동완성 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
# 최신 카페 6개 이상 더보기로 전체 불러옴
@require_GET
def latest_cafes_api(request):
    """최신 카페 더보기 API"""
    try:
        page = int(request.GET.get('page', 1))
        per_page = int(request.GET.get('per_page', 6))
        
        # 제한값 검증
        if page < 1 or per_page < 1 or per_page > 50:
            return JsonResponse({'success': False, 'error': '잘못된 페이징 정보입니다.'})
        
        start = (page - 1) * per_page
        end = start + per_page
        
        # 승인된 모든 카페를 최신순으로 가져오기
        cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member').order_by('-created_at')[start:end]
        
        total_count = BdayCafe.objects.filter(status='approved').count()
        
        # 데이터 직렬화
        cafe_data = []
        for cafe in cafes:
            try:
                cafe_data.append({
                    'id': cafe.id,
                    'cafe_name': cafe.cafe_name,
                    'artist_name': cafe.artist.display_name if cafe.artist else '',
                    'member_name': cafe.member.member_name if cafe.member else '',
                    'main_image': cafe.get_main_image(),
                    'place_name': cafe.place_name or '',
                    'address': cafe.address or '',
                    'start_date': cafe.start_date.isoformat() if cafe.start_date else '',
                    'end_date': cafe.end_date.isoformat() if cafe.end_date else '',
                    'is_active': cafe.is_active,
                    'days_remaining': cafe.days_remaining,
                    'special_benefits': cafe.special_benefits or '',
                })
            except Exception as e:
                logger.warning(f"카페 {cafe.id} 데이터 처리 오류: {e}")
                continue
        
        return JsonResponse({
            'success': True,
            'cafes': cafe_data,
            'has_more': end < total_count,
            'total': total_count,
            'current_page': page,
            'per_page': per_page
        })
        
    except ValueError as e:
        logger.warning(f"최신 카페 API 파라미터 오류: {e}")
        return JsonResponse({'success': False, 'error': '잘못된 요청 파라미터입니다.'})
    except Exception as e:
        logger.error(f"최신 카페 API 오류: {e}")
        return JsonResponse({'success': False, 'error': '서버 오류가 발생했습니다.'})