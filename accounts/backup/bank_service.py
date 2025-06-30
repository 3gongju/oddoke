import json
import random
import time
import requests
from datetime import datetime
from django.conf import settings

class MockBankService:
    """
    Mock 계좌인증 서비스
    - 실제 API와 동일한 인터페이스 제공
    - 완전한 비즈니스 로직 구현
    - 나중에 실제 API로 쉽게 교체 가능
    """
    
    def __init__(self):
        self.service_name = "Mock 계좌인증 서비스"
        print(f"🧪 {self.service_name} 초기화 완료")
    
    def verify_bank(self, bank_code, bank_number, bank_holder):
        """
        Mock 계좌 실명 확인
        실제 API와 동일한 응답 형식 제공
        
        Args:
            bank_code (str): 은행 코드 (예: '004')
            bank_number (str): 계좌번호
            bank_holder (str): 예금주명
            
        Returns:
            dict: 확인 결과 {'success': bool, 'message': str, 'verified_name': str}
        """
        print(f"🔍 Mock 계좌 인증 중...")
        print(f"   은행: {self.get_bank_name(bank_code)}")
        print(f"   계좌: {bank_number[:4]}****")
        print(f"   예금주: {bank_holder}")
        
        # 실제 API 호출처럼 약간의 지연 시간 시뮬레이션
        time.sleep(0.5)
        
        # 계좌번호와 예금주명 검증
        validation_result = self._validate_bank_data(bank_code, bank_number, bank_holder)
        if not validation_result['valid']:
            return {
                'success': False,
                'message': validation_result['message'],
                'verified_name': None
            }
        
        # Mock 성공 케이스들 (테스트용 데이터)
        success_cases = self._get_success_test_cases()
        
        # 입력된 정보와 매칭되는 성공 케이스 찾기
        test_key = (bank_code, bank_number.replace('-', '').replace(' ', ''), bank_holder.strip())
        
        if test_key in success_cases:
            print("✅ Mock 계좌 인증 성공!")
            return {
                'success': True,
                'message': '계좌 인증이 완료되었습니다. (Mock 서비스)',
                'verified_name': bank_holder
            }
        
        # 실패 케이스 처리
        return self._handle_failure_case(bank_code, bank_number, bank_holder)
    
    def _validate_bank_data(self, bank_code, bank_number, bank_holder):
        """입력 데이터 유효성 검사"""
        
        # 은행 코드 검증
        if not self._is_valid_bank_code(bank_code):
            return {
                'valid': False,
                'message': f'지원하지 않는 은행입니다. (은행코드: {bank_code})'
            }
        
        # 계좌번호 형식 검증
        clean_bank = bank_number.replace('-', '').replace(' ', '')
        if not clean_bank.isdigit():
            return {
                'valid': False,
                'message': '계좌번호는 숫자만 입력 가능합니다.'
            }
        
        if len(clean_bank) < 8 or len(clean_bank) > 20:
            return {
                'valid': False,
                'message': '계좌번호는 8~20자리여야 합니다.'
            }
        
        # 예금주명 검증
        if not bank_holder or len(bank_holder.strip()) < 2:
            return {
                'valid': False,
                'message': '예금주명을 정확히 입력해주세요.'
            }
        
        if len(bank_holder.strip()) > 20:
            return {
                'valid': False,
                'message': '예금주명이 너무 깁니다. (최대 20자)'
            }
        
        return {'valid': True, 'message': '유효한 데이터'}
    
    def _get_success_test_cases(self):
        """
        테스트용 성공 케이스들
        실제 개발/테스트 시 사용할 수 있는 Mock 데이터
        """
        return [
            # (은행코드, 계좌번호, 예금주명)
            ('004', '1234567890', '홍길동'),      # KB국민은행
            ('088', '9876543210', '김철수'),      # 신한은행
            ('020', '1111111111', '이영희'),      # 우리은행
            ('003', '2222222222', '박민수'),      # IBK기업은행
            ('011', '3333333333', '최유진'),      # NH농협은행
            ('081', '4444444444', '정대한'),      # KEB하나은행
            ('023', '5555555555', '강민지'),      # SC제일은행
            ('090', '1000000001', '김토스'),      # 카카오뱅크
            ('089', '2000000002', '박케이'),      # 케이뱅크
            ('092', '3000000003', '이토스'),      # 토스뱅크
            ('031', '6666666666', '대구사람'),    # 대구은행
            ('032', '7777777777', '부산사람'),    # 부산은행
        ]
    
    def _handle_failure_case(self, bank_code, bank_number, bank_holder):
        """실패 케이스 처리 및 사용자 친화적 메시지 제공"""
        
        print("❌ Mock 계좌 인증 실패")
        
        # 랜덤하게 다양한 실패 시나리오 시뮬레이션
        failure_scenarios = [
            {
                'message': '예금주명이 일치하지 않습니다.',
                'weight': 0.6  # 가장 흔한 실패 원인
            },
            {
                'message': '존재하지 않는 계좌번호입니다.',
                'weight': 0.25
            },
            {
                'message': '계좌가 정지되었거나 사용할 수 없는 상태입니다.',
                'weight': 0.1
            },
            {
                'message': '계좌인증 서비스 일시 중단 중입니다. 잠시 후 다시 시도해주세요.',
                'weight': 0.05
            }
        ]
        
        # 가중치 기반 랜덤 선택
        rand = random.random()
        cumulative = 0
        selected_scenario = failure_scenarios[0]
        
        for scenario in failure_scenarios:
            cumulative += scenario['weight']
            if rand <= cumulative:
                selected_scenario = scenario
                break
        
        # 성공 케이스 안내 메시지 포함
        help_message = self._get_help_message()
        
        return {
            'success': False,
            'message': f"{selected_scenario['message']}\n\n{help_message}",
            'verified_name': None
        }
    
    def _get_help_message(self):
        """사용자 도움말 메시지"""
        return """✅ Mock 서비스 테스트 성공 케이스:
• KB국민(004) - 1234567890 - 홍길동
• 신한(088) - 9876543210 - 김철수  
• 우리(020) - 1111111111 - 이영희
• 카카오뱅크(090) - 1000000001 - 김토스

💡 실제 서비스에서는 본인의 실제 계좌 정보를 입력하세요."""
    
    def _is_valid_bank_code(self, bank_code):
        """지원하는 은행 코드인지 확인"""
        supported_banks = {
            '004', '088', '020', '003', '011', '081', '023',
            '090', '089', '092', '031', '032', '034', '037', '039'
        }
        return bank_code in supported_banks
    
    def get_bank_name(self, bank_code):
        """은행 코드로 은행명 반환"""
        bank_dict = {
            '004': 'KB국민은행',
            '088': '신한은행', 
            '020': '우리은행',
            '003': 'IBK기업은행',
            '011': 'NH농협은행',
            '081': 'KEB하나은행',
            '023': 'SC제일은행',
            '090': '카카오뱅크',
            '089': '케이뱅크',
            '092': '토스뱅크',
            '031': '대구은행',
            '032': '부산은행',
            '034': '광주은행',
            '037': '전북은행',
            '039': '경남은행',
        }
        return bank_dict.get(bank_code, f'알 수 없는 은행({bank_code})')
    
    def get_supported_banks(self):
        """지원하는 은행 목록 반환"""
        return [
            {'code': '004', 'name': 'KB국민은행'},
            {'code': '088', 'name': '신한은행'},
            {'code': '020', 'name': '우리은행'},
            {'code': '003', 'name': 'IBK기업은행'},
            {'code': '011', 'name': 'NH농협은행'},
            {'code': '081', 'name': 'KEB하나은행'},
            {'code': '023', 'name': 'SC제일은행'},
            {'code': '090', 'name': '카카오뱅크'},
            {'code': '089', 'name': '케이뱅크'},
            {'code': '092', 'name': '토스뱅크'},
            {'code': '031', 'name': '대구은행'},
            {'code': '032', 'name': '부산은행'},
            {'code': '034', 'name': '광주은행'},
            {'code': '037', 'name': '전북은행'},
            {'code': '039', 'name': '경남은행'},
        ]
    
    def get_service_status(self):
        """서비스 상태 정보 반환"""
        return {
            'service_name': self.service_name,
            'status': 'active',
            'type': 'mock',
            'supported_banks_count': len(self.get_supported_banks()),
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }


# 서비스 팩토리 함수
def get_bank_service():
    """
    환경에 따라 적절한 Bank Service 반환
    현재는 Mock 서비스만 제공, 나중에 실제 API 추가 가능
    
    Returns:
        MockBankService: Mock 계좌인증 서비스
    """
    # 설정에서 Mock 사용 여부 확인
    use_mock = getattr(settings, 'USE_MOCK_BANK_SERVICE', True)
    
    if use_mock:
        print("🧪 Mock 계좌인증 서비스 사용")
        return MockBankService()
    else:
        # 나중에 실제 API 서비스 추가 예정
        # return RealBankService()
        print("⚠️ 실제 API 서비스는 아직 구현되지 않았습니다. Mock 서비스를 사용합니다.")
        return MockBankService()


# 테스트용 함수들
def test_mock_service():
    """Mock 서비스 테스트 함수"""
    print("\n" + "="*50)
    print("🧪 Mock 계좌인증 서비스 테스트")
    print("="*50)
    
    service = get_bank_service()
    
    # 성공 케이스 테스트
    print("\n✅ 성공 케이스 테스트:")
    result = service.verify_bank('004', '1234567890', '홍길동')
    print(f"결과: {result}")
    
    # 실패 케이스 테스트  
    print("\n❌ 실패 케이스 테스트:")
    result = service.verify_bank('004', '1234567890', '잘못된이름')
    print(f"결과: {result}")
    
    # 서비스 상태 확인
    print("\n📊 서비스 상태:")
    status = service.get_service_status()
    print(f"상태: {status}")
    
    # 지원 은행 목록
    print("\n🏦 지원 은행 목록:")
    banks = service.get_supported_banks()
    for bank in banks[:5]:  # 처음 5개만 출력
        print(f"  {bank['code']}: {bank['name']}")
    print(f"  ... 총 {len(banks)}개 은행 지원")


class DutcheatAPIService:
    """
    테스트 더치트 API 서비스
    계좌 사기 신고 이력 조회 기능
    """
    
    def __init__(self):
        self.base_url = "https://api.dutcheat.com"  # 실제 API URL로 변경
        self.api_key = getattr(settings, 'DUTCHEAT_API_KEY', 'test_api_key')
        self.service_name = "더치트 API 서비스"
        print(f"🔍 {self.service_name} 초기화 완료")
    
    def check_bank_fraud_history(self, bank_code, bank_number, bank_holder=None):
        """
        계좌 사기 신고 이력 조회
        
        Args:
            bank_code (str): 은행 코드 (예: '004')
            bank_number (str): 계좌번호 (하이픈 제거된 숫자만)
            bank_holder (str): 예금주명 (선택사항)
            
        Returns:
            dict: 조회 결과
        """
        print(f"🔍 계좌 사기 이력 조회 중...")
        print(f"   은행: {self.get_bank_name(bank_code)}")
        print(f"   계좌: {bank_number[:4]}****")
        if bank_holder:
            print(f"   예금주: {bank_holder}")
        
        # API 요청 데이터 준비
        request_data = {
            'bank_code': bank_code,
            'bank_number': bank_number,
            'api_key': self.api_key
        }
        
        if bank_holder:
            request_data['bank_holder'] = bank_holder
        
        try:
            # 실제 API 호출 (현재는 Mock 데이터 반환)
            # response = requests.post(f"{self.base_url}/fraud-check", json=request_data, timeout=10)
            # result = response.json()
            
            # Mock 데이터 반환 (테스트용)
            result = self._get_mock_fraud_data(bank_code, bank_number, bank_holder)
            
            return {
                'success': True,
                'has_reports': result['has_reports'],
                'report_count': result['report_count'],
                'reports': result['reports'],
                'last_updated': result['last_updated']
            }
            
        except Exception as e:
            print(f"❌ API 호출 오류: {e}")
            return {
                'success': False,
                'error': 'API 호출 중 오류가 발생했습니다.',
                'has_reports': False,
                'report_count': 0,
                'reports': []
            }
    
    def _get_mock_fraud_data(self, bank_code, bank_number, bank_holder):
        """
        Mock 사기 신고 데이터 생성 (테스트용)
        실제 API 연동 시 이 메서드는 제거
        """
        
        # 테스트용 사기 계좌 목록
        fraud_banks = [
            ('004', '1111111111', [
                {
                    'report_date': '2024-01-15',
                    'report_type': '판매 사기',
                    'amount': 150000,
                    'description': '상품 미발송 신고',
                    'status': '확인됨'
                },
                {
                    'report_date': '2024-02-03',
                    'report_type': '대금 미지급',
                    'amount': 85000,
                    'description': '거래 후 연락 두절',
                    'status': '처리중'
                }
            ]),
            ('088', '2222222222', [
                {
                    'report_date': '2024-03-10',
                    'report_type': '허위 상품',
                    'amount': 200000,
                    'description': '가짜 상품 판매',
                    'status': '확인됨'
                }
            ]),
            ('020', '9999999999', [
                {
                    'report_date': '2024-01-28',
                    'report_type': '계좌 도용',
                    'amount': 300000,
                    'description': '타인 명의 계좌 사용 의혹',
                    'status': '확인됨'
                },
                {
                    'report_date': '2024-02-14',
                    'report_type': '판매 사기',
                    'amount': 120000,
                    'description': '입금 후 상품 미발송',
                    'status': '확인됨'
                },
                {
                    'report_date': '2024-03-01',
                    'report_type': '연락 두절',
                    'amount': 95000,
                    'description': '거래 중 갑작스런 연락 두절',
                    'status': '처리중'
                }
            ])
        ]
        
        # 해당 계좌의 신고 이력 찾기
        clean_bank = bank_number.replace('-', '').replace(' ', '')
        
        for fraud_bank, fraud_bank, reports in fraud_banks:
            if fraud_bank == bank_code and fraud_bank == clean_bank:
                return {
                    'has_reports': True,
                    'report_count': len(reports),
                    'reports': reports,
                    'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
        
        # 신고 이력 없음
        return {
            'has_reports': False,
            'report_count': 0,
            'reports': [],
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def get_bank_name(self, bank_code):
        """은행 코드로 은행명 반환"""
        bank_dict = {
            '004': 'KB국민은행',
            '088': '신한은행', 
            '020': '우리은행',
            '003': 'IBK기업은행',
            '011': 'NH농협은행',
            '081': 'KEB하나은행',
            '023': 'SC제일은행',
            '090': '카카오뱅크',
            '089': '케이뱅크',
            '092': '토스뱅크',
            '031': '대구은행',
            '032': '부산은행',
            '034': '광주은행',
            '037': '전북은행',
            '039': '경남은행',
        }
        return bank_dict.get(bank_code, f'알 수 없는 은행({bank_code})')
    
    def get_service_status(self):
        """서비스 상태 정보 반환"""
        return {
            'service_name': self.service_name,
            'status': 'active',
            'api_url': self.base_url,
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }


# 서비스 팩토리 함수
def get_dutcheat_service():
    """
    더치트 API 서비스 인스턴스 반환
    
    Returns:
        DutcheatAPIService: 더치트 API 서비스
    """
    return DutcheatAPIService()


# 테스트용 함수
def test_dutcheat_service():
    """더치트 서비스 테스트 함수"""
    print("\n" + "="*50)
    print("🔍 더치트 API 서비스 테스트")
    print("="*50)
    
    service = get_dutcheat_service()
    
    # 신고 이력이 있는 계좌 테스트
    print("\n❌ 신고 이력이 있는 계좌 테스트:")
    result = service.check_bank_fraud_history('004', '1111111111', '사기꾼')
    print(f"결과: {result}")
    
    # 신고 이력이 없는 계좌 테스트  
    print("\n✅ 신고 이력이 없는 계좌 테스트:")
    result = service.check_bank_fraud_history('004', '1234567890', '홍길동')
    print(f"결과: {result}")
    
    # 서비스 상태 확인
    print("\n📊 서비스 상태:")
    status = service.get_service_status()
    print(f"상태: {status}")

if __name__ == "__main__":
    # 직접 실행시 테스트
    test_mock_service()  # 기존 Mock 서비스 테스트
    test_dutcheat_service()  # 새로운 더치트 서비스 테스트