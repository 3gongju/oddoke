# 팝업 경고 메세지 중앙화

"""
덕생 앱 메시지 중앙 관리
모든 사용자 메시지를 이 파일에서 관리
"""

# 중복 확인 관련 메시지
DUPLICATE_CHECK = {
    'NO_DUPLICATE': '해당 덕의 생카를 어덕해에 등록해주세요',
    'DUPLICATE_FOUND': '유사한 생일카페가 {count}개 발견되었습니다',
    'DUPLICATE_WARNING': '중복된 생카가 존재합니다',
    'CHECK_REQUIRED': '중복 확인을 먼저 해주세요',
    'VALIDATION_ERROR': '모든 정보를 입력해주세요',
    'SERVER_ERROR': '서버 내부 오류가 발생했습니다. 관리자에게 문의해주세요',
    'SELECT_CAFE_FIRST': '먼저 해당하는 카페를 선택해주세요',
    'REDIRECTING_TO_CAFE': '선택하신 카페 페이지로 이동합니다',
    'REGISTER_NEW_CAFE': '새로운 생카 등록을 진행합니다',
    'CHECKING_DUPLICATE': '중복 확인 중...',
    'BACK_TO_DUPLICATE_CHECK': '중복 확인 단계로 돌아갑니다',
    'COMPLETE_SUCCESS': '중복 확인 완료! 3초 후 다음 단계로 이동합니다.',
    'COMPLETE_TITLE': '중복 확인 완료!',
    'COMPLETE_MESSAGE': '동일한 생일카페가 없습니다. 새로운 카페를 등록하세요.',
    'COMPLETE_BUTTON': '다음 단계로 진행',
    'FIELD_REQUIRED_LIST': '다음 항목을 입력해주세요: {fields}',
}

# 폼 검증 관련 메시지
FORM_VALIDATION = {
    'REQUIRED_FIELD': '{field}을(를) 입력해주세요',
    'IMAGE_REQUIRED': '최소 1개의 이미지를 업로드해주세요',
    'DATE_RANGE_ERROR': '종료일은 시작일보다 늦어야 합니다',
    'DATE_REQUIRED': '시작일과 종료일을 모두 선택해주세요',
    'DATE_AUTO_ADJUSTED': '종료일이 시작일과 같은 날짜로 자동 조정되었습니다',
    'SEARCH_KEYWORD_REQUIRED': '검색어를 입력해주세요',
    'INVALID_DATE_FORMAT': '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)',
    'INVALID_COORDINATES': '유효하지 않은 좌표입니다',
    'INVALID_PARAMETER': '잘못된 파라미터입니다',
}

# 필드 라벨 (한국어)
FIELD_LABELS = {
    'final_artist_id': '아티스트',
    'cafe_name': '생카명',
    'address': '주소',
    'start_date': '시작일',
    'end_date': '종료일',
    'event_description': '이벤트 설명',
    'check_artist_id': '아티스트/멤버',
    'check_cafe_name': '카페명',
    'check_start_date': '시작일',
    'check_end_date': '종료일',
}

# 성공 메시지
SUCCESS_MESSAGES = {
    'CAFE_REGISTERED': '생카가 성공적으로 등록되었습니다',
    'FAVORITE_ADDED': '찜 목록에 추가했어요!',
    'FAVORITE_REMOVED': '찜 목록에서 제거했어요!',
    'IMAGE_UPLOADED': '이미지가 업로드되었습니다',
    'DUPLICATE_CHECK_COMPLETE': '중복 확인이 완료되었습니다',
    'NEW_CAFE_PROCEED': '새로운 생카 등록을 진행합니다',
}

# 토스트 메시지 타입별 기본 메시지
TOAST_MESSAGES = {
    'info': '정보가 업데이트되었습니다',
    'success': '작업이 완료되었습니다',
    'warning': '주의가 필요합니다',
    'error': '오류가 발생했습니다',
}

# 모든 메시지를 하나의 딕셔너리로 통합 (JavaScript에서 사용)
ALL_MESSAGES = {
    'DUPLICATE_CHECK': DUPLICATE_CHECK,
    'FORM_VALIDATION': FORM_VALIDATION,
    'FIELD_LABELS': FIELD_LABELS,
    'SUCCESS': SUCCESS_MESSAGES,
    'TOAST': TOAST_MESSAGES,
}

# 메시지 포맷팅 헬퍼 함수
def format_message(message_template, **kwargs):
    """
    메시지 템플릿에 값을 채워넣습니다.
    예: format_message("안녕하세요 {name}님", name="홍길동")
    """
    try:
        return message_template.format(**kwargs)
    except (KeyError, ValueError):
        return message_template

# 메시지 가져오기 헬퍼 함수
def get_message(category, key, **kwargs):
    """
    카테고리와 키로 메시지를 가져옵니다.
    예: get_message('DUPLICATE_CHECK', 'NO_DUPLICATE')
    """
    try:
        message = ALL_MESSAGES[category][key]
        return format_message(message, **kwargs)
    except KeyError:
        return f"메시지를 찾을 수 없습니다: {category}.{key}"