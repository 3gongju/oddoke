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
from ddoksang.models import BdayCafe, CafeFavorite  
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


#  한글 유사도 계산 클래스
class KoreanStringSimilarity:
    """한글 문자열 유사도 계산"""
    
    @staticmethod
    def normalize_korean(text):
        """한글 문자열 정규화 강화"""
        if not text:
            return ""
        
        # 1. 기본 정리
        text = text.strip().lower()
        
        # 2. 공백 제거
        text = re.sub(r'\s+', '', text)
        
        # 3. 특수문자 제거 (한글, 영문, 숫자만 남김)
        text = re.sub(r'[^\w가-힣ㄱ-ㅎㅏ-ㅣ]', '', text)
        
        # 4. 흔한 카페 관련 단어들 정규화
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
                # 초성, 중성, 종성 분리
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
        
        # 자모 분해
        jamo1 = ''.join(KoreanStringSimilarity.jamo_decompose(c) for c in str1)
        jamo2 = ''.join(KoreanStringSimilarity.jamo_decompose(c) for c in str2)
        
        # SequenceMatcher로 유사도 계산
        return SequenceMatcher(None, jamo1, jamo2).ratio()
    
    @staticmethod
    def calculate_similarity(str1, str2):
        """종합 유사도 계산"""
        if not str1 or not str2:
            return 0.0
        
        # 정규화
        norm1 = KoreanStringSimilarity.normalize_korean(str1)
        norm2 = KoreanStringSimilarity.normalize_korean(str2)
        
        if norm1 == norm2:
            return 1.0
        
        # 1. 일반 문자열 유사도
        general_sim = SequenceMatcher(None, norm1, norm2).ratio()
        
        # 2. 자모 분해 유사도
        jamo_sim = KoreanStringSimilarity.jamo_similarity(norm1, norm2)
        
        # 3. 길이 차이 고려
        len_diff = abs(len(norm1) - len(norm2))
        max_len = max(len(norm1), len(norm2))
        length_penalty = len_diff / max_len if max_len > 0 else 0
        
        # 4. 최종 유사도 (가중 평균)
        final_similarity = (general_sim * 0.6 + jamo_sim * 0.4) * (1 - length_penalty * 0.2)
        
        return min(1.0, max(0.0, final_similarity))


#  날짜 겹침 확인 함수
def check_date_overlap(start1, end1, start2, end2, tolerance_days=7):
    """두 날짜 범위가 겹치는지 확인 (여유일 포함)"""
    try:
        # 문자열을 날짜 객체로 변환
        if isinstance(start1, str):
            start1 = timezone.datetime.strptime(start1, '%Y-%m-%d').date()
        if isinstance(end1, str):
            end1 = timezone.datetime.strptime(end1, '%Y-%m-%d').date()
        if isinstance(start2, str):
            start2 = timezone.datetime.strptime(start2, '%Y-%m-%d').date()
        if isinstance(end2, str):
            end2 = timezone.datetime.strptime(end2, '%Y-%m-%d').date()
        
        # 여유일 적용
        tolerance = timedelta(days=tolerance_days)
        
        # 확장된 날짜 범위
        extended_start1 = start1 - tolerance
        extended_end1 = end1 + tolerance
        extended_start2 = start2 - tolerance  
        extended_end2 = end2 + tolerance
        
        # 겹침 확인
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
        # 현재 운영중인 카페들만 가져오기
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
        
        # map_utils의 serialize 함수 사용하고 추가 정보 포함
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
    """주변 카페 검색 API - 🔧 수정: 모든 아티스트의 카페 반환"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        radius_km = int(request.GET.get('radius', 3000)) / 1000  # 미터를 킬로미터로 변환
        
        if not is_valid_coordinates(lat, lng):
            return JsonResponse({'success': False, 'error': '유효하지 않은 좌표입니다.'}, status=400)
        
        #  get_all_nearby_cafes 함수 사용 (모든 아티스트)
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

        # 승인된 모든 카페 (운영 상태 무관)
        cafes = BdayCafe.objects.filter(
            status='approved'
        ).select_related('artist', 'member').order_by('-created_at')

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
            BdayCafe.objects.select_related('artist', 'member'),
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
            'cafe_type_display': cafe.get_cafe_type_display(),
            'days_remaining': cafe.days_remaining,
            'days_until_start': cafe.days_until_start,
            'special_benefits_list': cafe.special_benefits.split(',') if cafe.special_benefits else [],
            # 이미지 목록

             'images': cafe.get_all_images(),
            

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


@require_GET
def check_duplicate_cafe(request):
    """
    생일카페 중복 확인 API - UI 개선 버전
    """
    try:
        # 로그 설정
        import logging
        logger = logging.getLogger(__name__)
        
        artist_id = request.GET.get('artist_id')
        member_id = request.GET.get('member_id', '')
        cafe_name = request.GET.get('cafe_name', '').strip()
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        logger.info(f"중복 확인 요청 - artist_id: {artist_id}, member_id: {member_id}, cafe_name: {cafe_name}, dates: {start_date}~{end_date}")
        
        # 필수 파라미터 체크
        if not all([artist_id, cafe_name, start_date, end_date]):
            logger.warning("필수 파라미터 누락")
            return JsonResponse({
                'exists': False,
                'error': get_message('DUPLICATE_CHECK', 'VALIDATION_ERROR')
            })
        
        # artist_id 유효성 검증
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
        
        # member_id 유효성 검증 (선택사항)
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
        
        # 날짜 변환
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
        
        # 기본 필터: 같은 아티스트 + 정확한 날짜 일치
#        filters = Q(artist_id=artist_id) & Q(start_date__lte=end_date_obj) & Q(end_date__gte=start_date_obj)
        
        # 검색 로직 - 더 유연한 조건
        try:
            from django.db.models import Q
            from datetime import timedelta
            
            # 기본 필터: 같은 아티스트
            filters = Q(artist_id=artist_id)
            
            # 멤버가 지정된 경우 추가
            if member_id:
                filters = filters & Q(member_id=member_id)
            
            # 삭제되지 않은 카페만
            filters = filters & ~Q(status='rejected')
            
            # 날짜 범위를 확장해서 겹치는 카페들도 찾기
            # 여유 기간 설정 (전후 30일)
            tolerance_days = 30
            tolerance = timedelta(days=tolerance_days)
            
            extended_start = start_date_obj - tolerance
            extended_end = end_date_obj + tolerance
            
            # 기간이 겹치는 카페들 검색
            date_filter = Q(
                # 케이스 1: 기존 카페의 시작일이 확장된 범위 안에 있음
                start_date__range=(extended_start, extended_end)
            ) | Q(
                # 케이스 2: 기존 카페의 종료일이 확장된 범위 안에 있음
                end_date__range=(extended_start, extended_end)
            ) | Q(
                # 케이스 3: 기존 카페가 입력된 기간을 완전히 포함함
                start_date__lte=start_date_obj,
                end_date__gte=end_date_obj
            ) | Q(
                # 케이스 4: 입력된 기간이 기존 카페를 완전히 포함함
                start_date__gte=start_date_obj,
                end_date__lte=end_date_obj
            )
            
            filters = filters & date_filter
            
            # 해당 조건의 카페들 조회
            existing_cafes = BdayCafe.objects.filter(filters).select_related('artist', 'member')
            existing_cafes_list = list(existing_cafes)
            logger.info(f"확장된 검색 조건으로 찾은 카페 수: {len(existing_cafes_list)}")
            
        except Exception as e:
            logger.error(f"데이터베이스 쿼리 오류: {e}")
            return JsonResponse({
                'exists': False,
                'error': '데이터베이스 조회 중 오류가 발생했습니다.'
            }, status=500)
        
        # 카페명 유사성 검사 개선
        def normalize_name(name):
            """카페명 정규화 - 더 정확한 비교를 위해 개선"""
            import re
            try:
                # 1. 기본 정리
                normalized = name.strip().lower()
                
                # 2. 공백 정리
                normalized = re.sub(r'\s+', ' ', normalized)
                
                # 3. 특수문자 일부만 제거 (너무 강하게 제거하지 않음)
                normalized = re.sub(r'[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ-]', '', normalized)
                
                # 4. 카페 관련 단어만 정규화 (이름은 보존)
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
                
                # 5. 연속 공백 제거
                normalized = re.sub(r'\s+', '', normalized)
                
                logger.debug(f"정규화: '{name}' -> '{normalized}'")
                return normalized
            except Exception as e:
                logger.warning(f"이름 정규화 오류: {e}")
                return name.lower().replace(' ', '')
        
        normalized_input_name = normalize_name(cafe_name)
        logger.info(f"정규화된 입력 카페명: '{normalized_input_name}'")
        
        # 유사한 이름의 카페 찾기
        similar_cafes = []
        similarity_threshold = 0.5  # ✅ 임계값을 0.6에서 0.5로 더 낮춤
        
        try:
            from difflib import SequenceMatcher
            
            for cafe in existing_cafes_list:
                normalized_existing_name = normalize_name(cafe.cafe_name)
                logger.debug(f"비교: '{normalized_input_name}' vs '{normalized_existing_name}'")
                
                # 1. 완전 일치 확인
                if normalized_input_name == normalized_existing_name:
                    logger.info(f"완전 일치 발견: {cafe.cafe_name}")
                    similar_cafes.append(cafe)
                    continue
                
                # 2. 포함 관계 확인 (최소 3글자 이상일 때만)
                if len(normalized_input_name) >= 3 and len(normalized_existing_name) >= 3:
                    if (normalized_input_name in normalized_existing_name or 
                        normalized_existing_name in normalized_input_name):
                        logger.info(f"포함 관계 발견: {cafe.cafe_name}")
                        similar_cafes.append(cafe)
                        continue
                
                # 3. 공통 단어 확인
                input_words = set(normalized_input_name.split())
                existing_words = set(normalized_existing_name.split())
                if input_words and existing_words:
                    common_words = input_words.intersection(existing_words)
                    if len(common_words) >= 2 or (len(common_words) >= 1 and len(input_words) <= 2):
                        logger.info(f"공통 단어 발견: {cafe.cafe_name} (공통: {common_words})")
                        similar_cafes.append(cafe)
                        continue
                
                # 4. 유사도 확인 (더 관대하게)
                try:
                    similarity = SequenceMatcher(None, normalized_input_name, normalized_existing_name).ratio()
                    logger.debug(f"유사도: {similarity:.2f}")
                    
                    if similarity >= similarity_threshold:
                        logger.info(f"유사한 카페 발견: {cafe.cafe_name} (유사도: {similarity:.2f})")
                        similar_cafes.append(cafe)
                        continue
                        
                    # ✅ 추가: 더 관대한 검사 - 공통 글자가 많은 경우
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
        
        # 결과 반환
        exists = len(similar_cafes) > 0
        
        # ✅ 상세 디버깅 로그 추가
        logger.info(f"""
🔍 중복 확인 최종 결과:
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
            # ✅ 디버깅 정보 추가 (개발 환경에서만)
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
        
        # 중복 카페 정보 추가 (similar_cafes 필드명 사용)
        if exists:
            try:
                # 사용자 찜 목록 확인 (로그인된 경우)
                user_favorites = []
                if hasattr(request, 'user') and request.user.is_authenticated:
                    try:
                        user_favorites = list(
                            CafeFavorite.objects.filter(user=request.user)
                            .values_list('cafe_id', flat=True)
                        )
                    except Exception as e:
                        logger.warning(f"사용자 찜 목록 조회 실패: {e}")
                        user_favorites = []
                
                similar_cafes_data = []
                
                for cafe in similar_cafes:
                    try:
                        # 카페 상태 계산
                        from django.utils import timezone
                        today = timezone.now().date()
                        
                        if cafe.start_date <= today <= cafe.end_date:
                            cafe_state = 'ongoing'
                        elif cafe.start_date > today:
                            cafe_state = 'upcoming'
                        else:
                            cafe_state = 'ended'
                        
                        # 대표 이미지 (새로운 JSON 필드 기반)
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
                        
                        # 남은 일수 계산
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
                
                # ✅ similar_cafes 필드명으로 응답
                result['similar_cafes'] = similar_cafes_data
                
            except Exception as e:
                logger.error(f"중복 카페 정보 생성 오류: {e}")
                # 카페 정보 생성에 실패해도 기본 결과는 반환
                result['similar_cafes'] = []
        
        logger.info(f"중복 확인 결과: {cafe_name} -> {'중복' if exists else '신규'} (유사 카페: {len(similar_cafes)}개)")
        return JsonResponse(result)
        
    except Exception as e:
        # 최상위 예외 처리
        logger.error(f"중복 확인 최상위 오류: {e}")
        return JsonResponse({
            'exists': False,
            'error': get_message('DUPLICATE_CHECK', 'SERVER_ERROR')
        }, status=500)


def normalize(text):
    """기존 함수 유지 (하위 호환성)"""
    return ''.join(text.lower().split())