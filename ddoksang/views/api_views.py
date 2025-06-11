from datetime import date, datetime
import logging
import math

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods, require_GET
from django.core.paginator import Paginator
from django.utils import timezone
from django.db.models import Q
from django.template.loader import render_to_string
from ddoksang.models import BdayCafe, CafeFavorite


from ddoksang.utils.map_utils import calculate_distance
from django.conf import settings

DEFAULT_PAGE_SIZE = getattr(settings, 'DEFAULT_PAGE_SIZE', 10)
MAX_NEARBY_CAFES = getattr(settings, 'MAX_NEARBY_CAFES', 20)
logger = logging.getLogger(__name__)



def calculate_distance(lat1, lng1, lat2, lng2):
    R = 6371000  # Earth radius in meters
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat, delta_lng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)

    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def serialize_cafe(cafe):
    return {
        'id': cafe.id,
        'cafe_name': cafe.cafe_name,
        'name': cafe.cafe_name,
        'artist': cafe.artist.display_name if cafe.artist else '',
        'member': cafe.member.member_name if cafe.member else '',
        'start_date': cafe.start_date.isoformat(),
        'end_date': cafe.end_date.isoformat(),
        'main_image': cafe.get_main_image(),
        'address': cafe.address,
        'is_active': cafe.is_active,
        'days_remaining': cafe.days_remaining,
        'view_count': cafe.view_count,
        'special_benefits': cafe.special_benefits,
        'created_at': cafe.created_at.isoformat(),
        "latitude": cafe.latitude,
        "longitude": cafe.longitude,
    }

@require_GET
def bday_cafe_list_api(request):
    try:
        today = timezone.now().date()
        cafes = BdayCafe.objects.filter(status='approved', start_date__lte=today, end_date__gte=today)
        data = [serialize_cafe(cafe) for cafe in cafes.select_related('artist', 'member').prefetch_related('images')]
        return JsonResponse({'success': True, 'cafes': data, 'total': len(data)})
    except Exception as e:
        logger.error(f"카페 목록 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@require_GET
def cafe_quick_view(request, cafe_id):
    try:
        cafe = get_object_or_404(BdayCafe.objects.select_related('artist', 'member').prefetch_related('images'), id=cafe_id, status='approved')
        data = serialize_cafe(cafe)
        data.update({
            'road_address': cafe.road_address,
            'hashtags': cafe.hashtags,
            'event_description': cafe.event_description,
        })
        return JsonResponse({'success': True, 'cafe': data})
    except Exception as e:
        logger.error(f"카페 빠른 조회 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@require_GET
def nearby_cafes_api(request):
    try:
        lat, lng = float(request.GET.get('lat')), float(request.GET.get('lng'))
        radius = int(request.GET.get('radius', 3000))
        today = timezone.now().date()

        cafes = BdayCafe.objects.filter(status='approved', start_date__lte=today, end_date__gte=today)
        nearby = []
        for cafe in cafes:
            dist = calculate_distance(lat, lng, float(cafe.latitude), float(cafe.longitude))
            if dist <= radius:
                cafe_info = serialize_cafe(cafe)
                cafe_info.update({
                    'latitude': cafe.latitude,
                    'longitude': cafe.longitude,
                    'distance': round(dist),
                    'walk_time': round(dist / 80)
                })
                nearby.append(cafe_info)

        nearby.sort(key=lambda x: x['distance'])
        return JsonResponse({'success': True, 'cafes': nearby[:50], 'radius': radius})
    except Exception as e:
        logger.error(f"주변 카페 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@require_GET
def cafe_map_data_api(request):
    try:
        today = timezone.now().date()
        cafes = BdayCafe.objects.filter(status='approved', start_date__lte=today, end_date__gte=today)
        data = []
        for cafe in cafes:
            data.append({
                'id': cafe.id,
                'cafe_name': cafe.cafe_name,
                'latitude': cafe.latitude,
                'longitude': cafe.longitude,
                'artist_name': cafe.artist.display_name if cafe.artist else '',
                'member_name': cafe.member.member_name if cafe.member else '',
                'main_image_url': cafe.get_main_image(),
                'is_active': cafe.is_active
            })
        return JsonResponse({'success': True, 'cafes': data, 'total': len(data)})
    except Exception as e:
        logger.error(f"지도 데이터 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@require_GET
def search_suggestions_api(request):
    try:
        q = request.GET.get('q', '').strip()
        if len(q) < 2:
            return JsonResponse({'success': True, 'suggestions': []})
        cafes = BdayCafe.objects.filter(Q(artist__display_name__icontains=q) | Q(member__member_name__icontains=q), status='approved')[:10]
        suggestions = [{
            'id': cafe.id,
            'cafe_name': cafe.cafe_name,
            'artist_name': cafe.artist.display_name if cafe.artist else '',
            'member_name': cafe.member.member_name if cafe.member else '',
        } for cafe in cafes]
        return JsonResponse({'success': True, 'suggestions': suggestions})
    except Exception as e:
        logger.error(f"검색 자동완성 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@require_GET
def latest_cafes_api(request):
    try:
        page = int(request.GET.get('page', 1))
        per_page = 6

        cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member').prefetch_related('images').order_by('-created_at')

        paginator = Paginator(cafes, per_page)
        page_obj = paginator.get_page(page)

        user_favorites = []
        if request.user.is_authenticated:
            user_favorites = list(
                CafeFavorite.objects.filter(user=request.user)
                .values_list('cafe_id', flat=True)
            )

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
    except Exception as e:
        logger.error(f"Latest cafes API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
