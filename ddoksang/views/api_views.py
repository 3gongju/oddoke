from datetime import date, timedelta
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
import re

from django.http import JsonResponse
from difflib import SequenceMatcher
from ddoksang.models import BdayCafe
from artist.models import Artist, Member 

from ddoksang.messages import get_message, DUPLICATE_CHECK

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


class KoreanStringSimilarity:
    """한글 문자열 유사도 계산"""
    
    @staticmethod
    def normalize_korean(text):
        """한글 문자열 정규화 강화"""
        if not text:
            return ""
        
        text = text.strip().lower()
        text = re.sub(r'\s+', '', text)
        text = re.sub(r'[^\w가-힣ㄱ-ㅎㅏ-ㅣ]', '', text)
        
        replacements = {
            '카페': '',
            'cafe': '',
            '생일': '',
            'birthday': '',
            'bday': '',
            '생카': '',
            '컵홀더': '',
            '이벤트': '',
            'event': '',
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        return text
    
    @staticmethod
    def jamo_decompose(char):
        """한글 자모 분해"""
        try:
            if '가' <= char <= '힣':
                char_code = ord(char) - ord('가')
                jong = char_code % 28
                jung = (char_code - jong) // 28 % 21
                cho = (char_code - jong - jung * 28) // 28 // 21
                
                cho_list = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
                jung_list = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
                jong_list = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
                
                return cho_list[cho] + jung_list[jung] + jong_list[jong]
            else:
                return char
        except (IndexError, ValueError):
            return char
    
    @staticmethod
    def jamo_similarity(str1, str2):
        """자모 분해 기반 유사도"""
        if not str1 or not str2:
            return 0.0
        
        jamo1 = ''.join(KoreanStringSimilarity.jamo_decompose(c) for c in str1)
        jamo2 = ''.join(KoreanStringSimilarity.jamo_decompose(c) for c in str2)
        
        return SequenceMatcher(None, jamo1, jamo2).ratio()
    
    @staticmethod
    def calculate_similarity(str1, str2):
        """종합 유사도 계산"""
        if not str1 or not str2:
            return 0.0
        
        norm1 = KoreanStringSimilarity.normalize_korean(str1)
        norm2 = KoreanStringSimilarity.normalize_korean(str2)
        
        if norm1 == norm2:
            return 1.0
        
        general_sim = SequenceMatcher(None, norm1, norm2).ratio()
        jamo_sim = KoreanStringSimilarity.jamo_similarity(norm1, norm2)
        
        len_diff = abs(len(norm1) - len(norm2))
        max_len = max(len(norm1), len(norm2))
        length_penalty = len_diff / max_len if max_len > 0 else 0
        
        final_similarity = (general_sim * 0.6 + jamo_sim * 0.4) * (1 - length_penalty * 0.2)
        
        return min(1.0, max(0.0, final_similarity))


def check_date_overlap(start1, end1, start2, end2, tolerance_days=7):
    """두 날짜 범위가 겹치는지 확인 (여유일 포함)"""
    try:
        if isinstance(start1, str):
            start1 = timezone.datetime.strptime(start1, '%Y-%m-%d').date()
        if isinstance(end1, str):
            end1 = timezone.datetime.strptime(end1, '%Y-%m-%d').date()
        if isinstance(start2, str):
            start2 = timezone.datetime.strptime(start2, '%Y-%m-%d').date()
        if isinstance(end2, str):
            end2 = timezone.datetime.strptime(end2, '%Y-%m-%d').date()
        
        tolerance = timedelta(days=tolerance_days)
        
        extended_start1 = start1 - tolerance
        extended_end1 = end1 + tolerance
        extended_start2 = start2 - tolerance  
        extended_end2 = end2 + tolerance
        
        overlap = not (extended_end1 < extended_start2 or extended_end2 < extended_start1)
        
        logger.debug(f"날짜 겹침 확인: {start1}~{end1} vs {start2}~{end2} (여유: {tolerance_days}일) = {overlap}")
        
        return overlap
        
    except (ValueError, TypeError) as e:
        logger.error(f"날짜 파싱 오류: {e}")
        return False


@require_GET
def bday_cafe_list_api(request):
    """현재 운영중인 생일카페 목록 API"""
    try:
        cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member')
        operating_cafes = filter_operating_cafes(cafes)
        
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
            BdayCafe.objects.select_related('artist', 'member'), 
            id=cafe_id, 
            status='approved'
        )
        
        data = serialize_cafe_for_map(cafe)
        if data:
            data.update({
                'road_address': cafe.road_address,
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
        radius_km = int(request.GET.get('radius', 3000)) / 1000
        
        if not is_valid_coordinates(lat, lng):
            return JsonResponse({'success': False, 'error': '유효하지 않은 좌표입니다.'}, status=400)
        
        from ddoksang.utils.cafe_utils import get_all_nearby_cafes
        
        nearby_cafes = get_all_nearby_cafes(
            user_lat=lat,
            user_lng=lng,
            radius_km=radius_km,
            limit=MAX_NEARBY_CAFES
        )
        
        return JsonResponse({
            'success': True, 
            'cafes': nearby_cafes, 
            'radius': radius_km * 1000,
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
        cafes = BdayCafe.objects.filter(status='approved').select_related('artist', 'member')
        operating_cafes = filter_operating_cafes(cafes)
        
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
        
        cafes = BdayCafe.objects.filter(
            Q(artist__display_name__iexact=q) | Q(member__member_name__iexact=q), 
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

        cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member').order_by('-created_at')

        paginator = Paginator(cafes, per_page)
        page_obj = paginator.get_page(page)

        user_favorites = []
        if request.user.is_authenticated:
            user_favorites = list(
                request.user.favorite_cafes.values_list('id', flat=True)
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
        
    except ValueError as e:
        logger.error(f"Latest cafes API 파라미터 오류: {e}")
        return JsonResponse({'success': False, 'error': '잘못된 페이지 번호입니다.'}, status=400)
    except Exception as e:
        logger.error(f"Latest cafes API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_GET
def cafe_detail_api(request, cafe_id):
    """카페 상세 정보 API (모달 전용)"""
    try:
        cafe = get_object_or_404(
            BdayCafe.objects.select_related('artist', 'member'),
            id=cafe_id,
            status='approved'
        )
        
        data = serialize_cafe_for_map(cafe)
        if not data:
            return JsonResponse({'success': False, 'error': '카페 정보 처리 실패'}, status=500)
        
        data.update({
            'road_address': cafe.road_address,
            'cafe_type_display': cafe.get_cafe_type_display(),
            'days_remaining': cafe.days_remaining,
            'days_until_start': cafe.days_until_start,
            'special_benefits_list': cafe.special_benefits.split(',') if cafe.special_benefits else [],
            'images': cafe.get_all_images(),
        })
        
        is_favorited = False
        if request.user.is_authenticated:
            is_favorited = cafe.is_favorited_by(request.user)
        
        data['is_favorited'] = is_favorited
        
        return JsonResponse({'success': True, 'cafe': data})
        
    except Exception as e:
        logger.error(f"카페 상세 API 오류: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_GET
def check_duplicate_cafe(request):
    """생일카페 중복 확인 API"""
    try:
        artist_id = request.GET.get('artist_id')
        member_id = request.GET.get('member_id', '')
        cafe_name = request.GET.get('cafe_name', '').strip()
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        logger.info(f"중복 확인 요청 - artist_id: {artist_id}, member_id: {member_id}, cafe_name: {cafe_name}, dates: {start_date}~{end_date}")
        
        if not all([artist_id, cafe_name, start_date, end_date]):
            logger.warning("필수 파라미터 누락")
            return JsonResponse({
                'exists': False,
                'error': get_message('DUPLICATE_CHECK', 'VALIDATION_ERROR')
            })
        
        try:
            artist_id = int(artist_id)
            from artist.models import Artist
            artist = Artist.objects.get(id=artist_id)
        except (ValueError, TypeError):
            logger.warning(f"artist_id 타입 오류: {artist_id}")
            return JsonResponse({
                'exists': False,
                'error': '올바르지 않은 아티스트 ID 형식입니다.'
            })
        except Artist.DoesNotExist:
            logger.warning(f"존재하지 않는 artist_id: {artist_id}")
            return JsonResponse({
                'exists': False,
                'error': '존재하지 않는 아티스트입니다.'
            })
        except Exception as e:
            logger.error(f"아티스트 조회 오류: {e}")
            return JsonResponse({
                'exists': False,
                'error': '아티스트 정보를 확인할 수 없습니다.'
            })
        
        if member_id:
            try:
                member_id = int(member_id)
                from artist.models import Member
                member = Member.objects.get(id=member_id, artist_id=artist_id)
            except (ValueError, TypeError):
                logger.warning(f"member_id 타입 오류: {member_id}")
                member_id = None
            except Member.DoesNotExist:
                logger.warning(f"존재하지 않는 member_id: {member_id}")
                member_id = None
            except Exception as e:
                logger.warning(f"멤버 조회 오류: {e}")
                member_id = None
        else:
            member_id = None
        
        try:
            from datetime import datetime
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            if start_date_obj > end_date_obj:
                return JsonResponse({
                    'exists': False,
                    'error': '종료일은 시작일보다 늦어야 합니다.'
                })
                
        except ValueError as e:
            logger.warning(f"날짜 형식 오류: {e}")
            return JsonResponse({
                'exists': False,
                'error': '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'
            })
        except Exception as e:
            logger.error(f"날짜 처리 오류: {e}")
            return JsonResponse({
                'exists': False,
                'error': '날짜 처리 중 오류가 발생했습니다.'
            })
        
        try:
            from django.db.models import Q
            from datetime import timedelta
            
            filters = Q(artist_id=artist_id)
            
            if member_id:
                filters = filters & Q(member_id=member_id)
            
            filters = filters & ~Q(status='rejected')
            
            tolerance_days = 30
            tolerance = timedelta(days=tolerance_days)
            
            extended_start = start_date_obj - tolerance
            extended_end = end_date_obj + tolerance
            
            date_filter = Q(
                start_date__range=(extended_start, extended_end)
            ) | Q(
                end_date__range=(extended_start, extended_end)
            ) | Q(
                start_date__lte=start_date_obj,
                end_date__gte=end_date_obj
            ) | Q(
                start_date__gte=start_date_obj,
                end_date__lte=end_date_obj
            )
            
            filters = filters & date_filter
            
            existing_cafes = BdayCafe.objects.filter(filters).select_related('artist', 'member')
            existing_cafes_list = list(existing_cafes)
            logger.info(f"확장된 검색 조건으로 찾은 카페 수: {len(existing_cafes_list)}")
            
        except Exception as e:
            logger.error(f"데이터베이스 쿼리 오류: {e}")
            return JsonResponse({
                'exists': False,
                'error': '데이터베이스 조회 중 오류가 발생했습니다.'
            }, status=500)
        
        def normalize_name(name):
            """카페명 정규화"""
            import re
            try:
                normalized = name.strip().lower()
                normalized = re.sub(r'\s+', ' ', normalized)
                normalized = re.sub(r'[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ-]', '', normalized)
                
                replacements = {
                    ' 생일카페': '',
                    ' 생일 카페': '',
                    ' 카페': '',
                    ' cafe': '',
                    'birthday': '',
                    'bday': '',
                }
                
                for old, new in replacements.items():
                    normalized = normalized.replace(old, new)
                
                normalized = re.sub(r'\s+', '', normalized)
                
                logger.debug(f"정규화: '{name}' -> '{normalized}'")
                return normalized
            except Exception as e:
                logger.warning(f"이름 정규화 오류: {e}")
                return name.lower().replace(' ', '')
        
        normalized_input_name = normalize_name(cafe_name)
        logger.info(f"정규화된 입력 카페명: '{normalized_input_name}'")
        
        similar_cafes = []
        similarity_threshold = 0.5
        
        try:
            from difflib import SequenceMatcher
            
            for cafe in existing_cafes_list:
                normalized_existing_name = normalize_name(cafe.cafe_name)
                logger.debug(f"비교: '{normalized_input_name}' vs '{normalized_existing_name}'")
                
                if normalized_input_name == normalized_existing_name:
                    logger.info(f"완전 일치 발견: {cafe.cafe_name}")
                    similar_cafes.append(cafe)
                    continue
                
                if len(normalized_input_name) >= 3 and len(normalized_existing_name) >= 3:
                    if (normalized_input_name in normalized_existing_name or 
                        normalized_existing_name in normalized_input_name):
                        logger.info(f"포함 관계 발견: {cafe.cafe_name}")
                        similar_cafes.append(cafe)
                        continue
                
                input_words = set(normalized_input_name.split())
                existing_words = set(normalized_existing_name.split())
                if input_words and existing_words:
                    common_words = input_words.intersection(existing_words)
                    if len(common_words) >= 2 or (len(common_words) >= 1 and len(input_words) <= 2):
                        logger.info(f"공통 단어 발견: {cafe.cafe_name} (공통: {common_words})")
                        similar_cafes.append(cafe)
                        continue
                
                try:
                    similarity = SequenceMatcher(None, normalized_input_name, normalized_existing_name).ratio()
                    logger.debug(f"유사도: {similarity:.2f}")
                    
                    if similarity >= similarity_threshold:
                        logger.info(f"유사한 카페 발견: {cafe.cafe_name} (유사도: {similarity:.2f})")
                        similar_cafes.append(cafe)
                        continue
                        
                    common_chars = set(normalized_input_name) & set(normalized_existing_name)
                    if len(common_chars) >= min(len(normalized_input_name), len(normalized_existing_name)) * 0.7:
                        logger.info(f"공통 글자 많음: {cafe.cafe_name} (공통 글자: {len(common_chars)}개)")
                        similar_cafes.append(cafe)
                        
                except Exception as e:
                    logger.warning(f"유사도 계산 오류: {e}")
                    continue
            
        except Exception as e:
            logger.error(f"유사성 검사 오류: {e}")
            return JsonResponse({
                'exists': False,
                'error': '유사성 검사 중 오류가 발생했습니다.'
            }, status=500)
        
        exists = len(similar_cafes) > 0
        
        logger.info(f"""
중복 확인 최종 결과:
- 입력 카페명: {cafe_name}
- 정규화된 이름: {normalized_input_name}
- 검색된 기존 카페 수: {len(existing_cafes_list)}
- 유사한 카페 수: {len(similar_cafes)}
- 중복 존재 여부: {exists}
- 검색 조건: 아티스트={artist_id}, 멤버={member_id}, 기간={start_date}~{end_date}
        """)
        
        if exists:
            logger.info("발견된 유사 카페들:")
            for i, cafe in enumerate(similar_cafes, 1):
                logger.info(f"  {i}. {cafe.cafe_name} (ID: {cafe.id})")
        
        result = {
            'exists': exists,
            'message': (
                get_message('DUPLICATE_CHECK', 'DUPLICATE_FOUND', count=len(similar_cafes))
                if exists 
                else get_message('DUPLICATE_CHECK', 'NO_DUPLICATE')
            ),
            'similar_count': len(similar_cafes),
            'debug_info': {
                'normalized_input': normalized_input_name,
                'existing_cafes_count': len(existing_cafes_list),
                'similarity_threshold': similarity_threshold,
                'search_conditions': {
                    'artist_id': artist_id,
                    'member_id': member_id,
                    'start_date': start_date,
                    'end_date': end_date,
                }
            } if settings.DEBUG else None
        }
        
        if exists:
            try:
                user_favorites = []
                if hasattr(request, 'user') and request.user.is_authenticated:
                    try:
                        user_favorites = list(
                            request.user.favorite_cafes.values_list('id', flat=True)
                        )
                    except Exception as e:
                        logger.warning(f"사용자 찜 목록 조회 실패: {e}")
                        user_favorites = []
                
                similar_cafes_data = []
                
                for cafe in similar_cafes:
                    try:
                        from django.utils import timezone
                        today = timezone.now().date()
                        
                        if cafe.start_date <= today <= cafe.end_date:
                            cafe_state = 'ongoing'
                        elif cafe.start_date > today:
                            cafe_state = 'upcoming'
                        else:
                            cafe_state = 'ended'
                        
                        main_image = None
                        try:
                            all_images = cafe.get_all_images()
                            if all_images:
                                main_image = all_images[0]['url']
                        except Exception as e:
                            logger.warning(f"이미지 URL 처리 오류: {e}")
                        
                        cafe_data = {
                            'id': cafe.id,
                            'cafe_name': cafe.cafe_name,
                            'artist_name': cafe.artist.display_name if cafe.artist else '',
                            'member_name': cafe.member.member_name if cafe.member else '',
                            'start_date': cafe.start_date.strftime('%Y년 %m월 %d일'),
                            'end_date': cafe.end_date.strftime('%Y년 %m월 %d일'),
                            'address': cafe.address or '',
                            'place_name': getattr(cafe, 'place_name', None) or cafe.address or '',
                            'status': cafe.status,
                            'status_display': cafe.get_status_display(),
                            'cafe_state': cafe_state,
                            'main_image': main_image,
                            'is_favorited': cafe.id in user_favorites,
                            'detail_url': f'/ddoksang/cafe/{cafe.id}/',
                        }
                        
                        try:
                            if cafe_state == 'upcoming':
                                days_until_start = (cafe.start_date - today).days
                                if days_until_start <= 7:
                                    cafe_data['days_until_start'] = days_until_start
                            elif cafe_state == 'ongoing':
                                days_remaining = (cafe.end_date - today).days
                                if days_remaining <= 7:
                                    cafe_data['days_remaining'] = days_remaining
                        except Exception as e:
                            logger.warning(f"날짜 계산 오류: {e}")
                        
                        similar_cafes_data.append(cafe_data)
                        
                    except Exception as e:
                        logger.error(f"카페 데이터 처리 오류 (cafe_id: {cafe.id}): {e}")
                        continue
                
                result['similar_cafes'] = similar_cafes_data
                
            except Exception as e:
                logger.error(f"중복 카페 정보 생성 오류: {e}")
                result['similar_cafes'] = []
        
        logger.info(f"중복 확인 결과: {cafe_name} -> {'중복' if exists else '신규'} (유사 카페: {len(similar_cafes)}개)")
        return JsonResponse(result)
        
    except Exception as e:
        logger.error(f"중복 확인 최상위 오류: {e}")
        return JsonResponse({
            'exists': False,
            'error': get_message('DUPLICATE_CHECK', 'SERVER_ERROR')
        }, status=500)


def normalize(text):
    """기존 함수 유지 (하위 호환성)"""
    return ''.join(text.lower().split())