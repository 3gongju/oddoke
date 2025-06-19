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


# ✅ 추가: 한글 유사도 계산 클래스
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


# ✅ 추가: 날짜 겹침 확인 함수
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
    """주변 카페 검색 API - 🔧 수정: 모든 아티스트의 카페 반환"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        radius_km = int(request.GET.get('radius', 3000)) / 1000  # 미터를 킬로미터로 변환
        
        if not is_valid_coordinates(lat, lng):
            return JsonResponse({'success': False, 'error': '유효하지 않은 좌표입니다.'}, status=400)
        
        # 🔧 수정: get_all_nearby_cafes 함수 사용 (모든 아티스트)
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


# ✅ 개선된 중복 확인 API
@require_GET
def check_duplicate_cafe(request):
    """
    생일카페 중복 확인 API - 대폭 개선된 버전
    """
    try:
        logger.info("=== 중복 확인 API 시작 ===")
        
        # 파라미터 받기
        artist_id = request.GET.get('artist_id')
        member_id = request.GET.get('member_id', '')
        cafe_name = request.GET.get('cafe_name', '').strip()
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        logger.info(f"📝 입력 정보:")
        logger.info(f"  아티스트ID: {artist_id}")
        logger.info(f"  멤버ID: {member_id}")
        logger.info(f"  카페명: '{cafe_name}'")
        logger.info(f"  기간: {start_date} ~ {end_date}")
        
        # 필수 파라미터 체크
        if not all([artist_id, cafe_name, start_date, end_date]):
            logger.warning("❌ 필수 파라미터 누락")
            return JsonResponse({
                'exists': False,
                'error': get_message('DUPLICATE_CHECK', 'VALIDATION_ERROR')
            })
        
        # artist_id 유효성 검증
        try:
            artist_id = int(artist_id)
            artist = Artist.objects.get(id=artist_id)
            logger.info(f"✅ 아티스트 확인: {artist.display_name}")
        except (ValueError, TypeError):
            logger.warning(f"❌ artist_id 타입 오류: {artist_id}")
            return JsonResponse({
                'exists': False,
                'error': '올바르지 않은 아티스트 ID 형식입니다.'
            })
        except Artist.DoesNotExist:
            logger.warning(f"❌ 존재하지 않는 artist_id: {artist_id}")
            return JsonResponse({
                'exists': False,
                'error': '존재하지 않는 아티스트입니다.'
            })
        
        # member_id 유효성 검증 (선택사항)
        member = None
        if member_id:
            try:
                member_id = int(member_id)
                member = Member.objects.get(id=member_id, artist_id=artist_id)
                logger.info(f"✅ 멤버 확인: {member.member_name}")
            except (ValueError, TypeError, Member.DoesNotExist):
                logger.warning(f"❌ member_id 오류: {member_id} - 무시하고 진행")
                member_id = None
                member = None
        
        # 날짜 변환 및 검증
        try:
            from datetime import datetime
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            if start_date_obj > end_date_obj:
                return JsonResponse({
                    'exists': False,
                    'error': '종료일은 시작일보다 늦어야 합니다.'
                })
            
            logger.info(f"✅ 날짜 변환 완료: {start_date_obj} ~ {end_date_obj}")
                
        except ValueError as e:
            logger.warning(f"❌ 날짜 형식 오류: {e}")
            return JsonResponse({
                'exists': False,
                'error': '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'
            })
        
        # ✅ 개선된 검색 로직: 더 넓은 범위에서 검색
        try:
            logger.info("🔍 중복 카페 검색 시작...")
            
            # 1단계: 같은 아티스트의 모든 활성 카페 조회 (날짜 무관)
            base_query = BdayCafe.objects.filter(
                artist_id=artist_id,
                status__in=['pending', 'approved']  # 거절된 것만 제외
            ).select_related('artist', 'member').prefetch_related('images')
            
            # 멤버가 지정된 경우 해당 멤버의 카페만
            if member_id and member:
                base_query = base_query.filter(
                    Q(member_id=member_id) | Q(member__isnull=True)  # 해당 멤버 OR 그룹 전체
                )
            
            all_cafes = list(base_query)
            logger.info(f"📊 검색 대상 카페 수: {len(all_cafes)}")
            
            # 2단계: 카페명 + 날짜 겹침으로 유사 카페 찾기
            similar_cafes = []
            name_threshold = 0.7  # ✅ 70%로 낮춤 (더 민감하게)
            
            for cafe in all_cafes:
                logger.debug(f"\n🔍 검사 중: {cafe.cafe_name} (ID: {cafe.id})")
                
                # 카페명 유사도 계산 (개선된 한글 유사도)
                similarity = KoreanStringSimilarity.calculate_similarity(cafe_name, cafe.cafe_name)
                logger.debug(f"  카페명 유사도: {similarity:.3f}")
                
                # 날짜 겹침 확인 (7일 여유)
                date_overlap = check_date_overlap(
                    start_date_obj, end_date_obj,
                    cafe.start_date, cafe.end_date,
                    tolerance_days=7
                )
                logger.debug(f"  날짜 겹침: {date_overlap}")
                
                # ✅ 조건: 높은 유사도 OR (중간 유사도 + 날짜 겹침)
                is_similar = False
                reason = ""
                
                if similarity >= 0.9:  # 90% 이상은 무조건 의심
                    is_similar = True
                    reason = f"높은 유사도 ({similarity:.1%})"
                elif similarity >= name_threshold and date_overlap:
                    is_similar = True
                    reason = f"유사도 ({similarity:.1%}) + 날짜겹침"
                elif similarity >= 0.8 and cafe.cafe_name.replace(' ', '').lower() in cafe_name.replace(' ', '').lower():
                    is_similar = True
                    reason = f"포함 관계 감지 ({similarity:.1%})"
                
                if is_similar:
                    logger.info(f"  ⚠️ 유사 카페 발견: {reason}")
                    similar_cafes.append({
                        'cafe': cafe,
                        'similarity': similarity,
                        'date_overlap': date_overlap,
                        'reason': reason
                    })
                else:
                    logger.debug(f"  ✅ 유사하지 않음")
            
            logger.info(f"🎯 최종 결과: {len(similar_cafes)}개 유사 카페 발견")
            
        except Exception as e:
            logger.error(f"❌ 중복 검사 중 오류: {e}")
            import traceback
            traceback.print_exc()
            return JsonResponse({
                'exists': False,
                'error': '중복 확인 중 오류가 발생했습니다.'
            }, status=500)
        
        # 3단계: 결과 처리 및 응답
        exists = len(similar_cafes) > 0
        
        result = {
            'exists': exists,
            'message': (
                f'유사한 생일카페가 {len(similar_cafes)}개 발견되었습니다. 확인해주세요.'
                if exists 
                else '동일한 생일카페가 없습니다. 새로운 카페를 등록하세요.'
            ),
            'similar_count': len(similar_cafes),
            'search_info': {
                'total_checked': len(all_cafes),
                'name_threshold': name_threshold,
                'date_tolerance': 7
            }
        }
        
        # ✅ 중복 카페 정보 추가 (상위 5개만)
        if exists:
            try:
                # 유사도 순으로 정렬
                similar_cafes.sort(key=lambda x: x['similarity'], reverse=True)
                
                # 사용자 찜 목록 확인
                user_favorites = []
                if hasattr(request, 'user') and request.user.is_authenticated:
                    try:
                        user_favorites = list(
                            CafeFavorite.objects.filter(user=request.user)
                            .values_list('cafe_id', flat=True)
                        )
                    except Exception:
                        user_favorites = []
                
                duplicates = []
                for item in similar_cafes[:5]:  # 상위 5개만
                    cafe = item['cafe']
                    
                    try:
                        # 카페 상태 계산
                        today = timezone.now().date()
                        if cafe.start_date <= today <= cafe.end_date:
                            cafe_state = 'ongoing'
                        elif cafe.start_date > today:
                            cafe_state = 'upcoming'
                        else:
                            cafe_state = 'ended'
                        
                        # 대표 이미지
                        main_image = None
                        try:
                            if hasattr(cafe, 'images') and cafe.images.exists():
                                main_image = cafe.images.first().image.url
                        except Exception:
                            pass
                        
                        duplicates.append({
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
                            'similarity': round(item['similarity'], 3),
                            'similarity_percent': f"{item['similarity']*100:.1f}%",
                            'reason': item['reason'],
                            'date_overlap': item['date_overlap']
                        })
                        
                    except Exception as e:
                        logger.error(f"❌ 카페 데이터 처리 오류 (ID: {cafe.id}): {e}")
                        continue
                
                result['duplicates'] = duplicates
                
                # 디버깅 정보 추가
                if len(duplicates) > 0:
                    top_similarity = duplicates[0]['similarity']
                    logger.info(f"🔍 최고 유사도: {top_similarity:.3f} ({duplicates[0]['cafe_name']})")
                
            except Exception as e:
                logger.error(f"❌ 중복 카페 정보 생성 오류: {e}")
                result['duplicates'] = []
        
        # 최종 로그
        status_msg = "중복 발견" if exists else "신규 등록 가능"
        logger.info(f"✅ 중복 확인 완료: '{cafe_name}' -> {status_msg}")
        if exists:
            logger.info(f"  발견된 유사 카페: {len(similar_cafes)}개")
            for i, item in enumerate(similar_cafes[:3], 1):
                logger.info(f"    {i}. {item['cafe'].cafe_name} (유사도: {item['similarity']:.3f})")
        
        return JsonResponse(result)
        
    except Exception as e:
        # 최상위 예외 처리
        logger.error(f"❌ 중복 확인 API 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'exists': False,
            'error': get_message('DUPLICATE_CHECK', 'SERVER_ERROR')
        }, status=500)


def normalize(text):
    """기존 함수 유지 (하위 호환성)"""
    return ''.join(text.lower().split())