from datetime import date, datetime
from django.shortcuts import render
from django.http import JsonResponse
from django.core.cache import cache
from django.conf import settings
from artist.models import Member
from artist.templatetags.member_images import member_image
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

def birthday_calendar(request):
    """생일 캘린더 페이지 렌더링"""
    all_members = Member.objects.select_related().all()
    return render(request, 'bday_calendar/calendar.html', {
        'all_members': all_members
    })

def birthday_events_api(request):
    """생일 이벤트 API - 날짜별로 그룹화하여 반환"""
    try:
        # 캐시 키 생성 (일별로 캐시)
        cache_key = f"birthday_events_grouped_{date.today().strftime('%Y%m%d')}"
        cached_events = cache.get(cache_key)
        
        if cached_events is not None:
            logger.info(f"캐시에서 이벤트 반환: {len(cached_events)}개")
            return JsonResponse(cached_events, safe=False, json_dumps_params={'ensure_ascii': False})

        events = _generate_grouped_birthday_events()
        
        # 캐시에 저장 (24시간)
        cache.set(cache_key, events, 60 * 60 * 24)
        
        logger.info(f"새로 생성된 이벤트 수: {len(events)}")
        return JsonResponse(events, safe=False, json_dumps_params={'ensure_ascii': False})

    except Exception as e:
        logger.error(f"birthday_events_api 오류: {e}", exc_info=True)
        return JsonResponse([], safe=False)

def _generate_grouped_birthday_events():
    """날짜별로 그룹화된 생일 이벤트 생성"""
    today = date.today()
    current_year = today.year
    
    # 효율적인 쿼리 - 필요한 필드만 선택
    members = Member.objects.select_related().prefetch_related(
        'artist_name'
    ).exclude(
        member_bday__isnull=True
    ).exclude(
        member_bday__exact=''
    ).only(
        'member_name', 'member_bday', 'artist_name'
    )

    # 날짜별로 멤버들 그룹화
    members_by_date = defaultdict(list)
    processed_combinations = set()
    errors = []

    for member in members:
        try:
            member_data = _process_member_for_grouping(member, current_year, processed_combinations)
            if member_data:
                date_key = member_data['date_key']
                members_by_date[date_key].append(member_data)
        except Exception as e:
            error_msg = f"멤버 처리 오류 {member.member_name}: {e}"
            errors.append(error_msg)
            logger.warning(error_msg)

    if errors:
        logger.warning(f"처리 중 {len(errors)}개 오류 발생")

    # 날짜별 그룹을 개별 이벤트로 변환
    events = []
    for date_key, member_list in members_by_date.items():
        if member_list:
            # 각 멤버를 개별 이벤트로 생성 (클라이언트에서 그룹화)
            for member_data in member_list:
                events.append(_create_individual_event(member_data))

    return events

def _process_member_for_grouping(member, current_year, processed_combinations):
    """그룹화를 위한 멤버 데이터 처리"""
    if not member.member_bday:
        return None

    artist_names = list(member.artist_name.all())
    if not artist_names:
        return None

    first_artist_display = artist_names[0].display_name.strip()
    combo_key = (member.member_name.strip(), first_artist_display)

    # 중복 체크
    if combo_key in processed_combinations:
        return None

    # 생년월일 파싱
    try:
        birthday = _parse_birthday(member.member_bday, current_year)
    except ValueError as e:
        logger.warning(f"생일 파싱 실패 {member.member_name}: {e}")
        return None

    # 아티스트 정보 생성
    artist_display = ', '.join(a.display_name for a in artist_names)

    # 이미지 URL 처리
    image_url = _get_member_image_url(member.member_name, first_artist_display)

    processed_combinations.add(combo_key)

    return {
        'date_key': birthday.isoformat(),
        'birthday': birthday,
        'member_name': member.member_name,
        'artist_display_name': first_artist_display,
        'artist_full_name': artist_display,
        'image_url': image_url,
    }

def _create_individual_event(member_data):
    """개별 멤버 이벤트 생성 - 화면에 표시되지 않는 숨김 이벤트"""
    birthday = member_data['birthday']
    today = date.today()
    
    return {
        "id": f"{member_data['member_name']}_{member_data['date_key']}",
        "title": "",  # 빈 타이틀로 설정
        "start": member_data['date_key'],
        "allDay": True,
        "extendedProps": {
            "member_name": member_data['member_name'],
            "artist_display_name": member_data['artist_display_name'],
            "artist_full_name": member_data['artist_full_name'],
            "birth_date": f"{birthday.day}일",
            "image_url": member_data['image_url'],
        },
        # 완전히 투명하게 만들어서 보이지 않도록
        "backgroundColor": "transparent",
        "borderColor": "transparent", 
        "textColor": "transparent",
        "classNames": ["hidden-event"],  # CSS 클래스 추가
        "display": "none",
        "rendering": "none",  # 렌더링 자체를 비활성화
    }

def _parse_birthday(birthday_str, year):
    """생일 문자열 파싱"""
    try:
        # MM-DD 형식 파싱
        parts = birthday_str.strip().split('-')
        if len(parts) != 2:
            raise ValueError(f"잘못된 생일 형식: {birthday_str}")
        
        month, day = map(int, parts)
        
        # 유효성 검사
        if not (1 <= month <= 12):
            raise ValueError(f"잘못된 월: {month}")
        if not (1 <= day <= 31):
            raise ValueError(f"잘못된 일: {day}")
            
        return date(year, month, day)
    except (ValueError, TypeError) as e:
        raise ValueError(f"생일 파싱 오류: {birthday_str} - {e}")

def _get_member_image_url(member_name, artist_display):
    """멤버 이미지 URL 가져오기"""
    try:
        return member_image(member_name, artist_display)
    except Exception as e:
        logger.warning(f"이미지 로드 실패 {member_name}: {e}")
        return "/static/image/default_member.svg"

def _get_birthday_color(birthday, today):
    """생일에 따른 색상 반환"""
    if birthday.replace(year=today.year) == today:
        return "#ef4444"  # 오늘 생일 - 빨간색
    elif birthday.replace(year=today.year) == today:
        return "#f97316"  # 이번 주 생일 - 주황색
    return "#3b82f6"      # 기본 - 파란색