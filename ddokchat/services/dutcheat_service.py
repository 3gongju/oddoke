import json
import random
import time
import requests
from datetime import datetime
from django.conf import settings

class DutcheatAPIService:
    """
    더치트 API 서비스
    계좌 사기 신고 이력 조회 기능
    """
    
    def __init__(self):
        self.base_url = "https://api.dutcheat.com"  # 실제 API URL로 변경
        self.api_key = getattr(settings, 'DUTCHEAT_API_KEY', 'test_api_key')
        self.service_name = "더치트 API 서비스"
        print(f"🔍 {self.service_name} 초기화 완료")
    
    def check_bank_fraud_history(self, bank_code=None, bank_number=None, bank_holder=None):
        """
        계좌 사기 신고 이력 조회
        
        Args:
            bank_code (str): 은행 코드 (선택사항)
            bank_number (str): 계좌번호 (하이픈 제거된 숫자만)
            bank_holder (str): 예금주명 (선택사항)
            
        Returns:
            dict: 조회 결과
        """
        print(f"🔍 계좌 사기 이력 조회 중...")
        if bank_code:
            print(f"   은행: {self.get_bank_name(bank_code)}")
        print(f"   계좌: {bank_number[:4]}****")
        if bank_holder:
            print(f"   예금주: {bank_holder}")
        
        try:
            # 실제 API 호출 (현재는 Mock 데이터 반환)
            # response = requests.post(f"{self.base_url}/fraud-check", 
            #                         json={
            #                             'bank_code': bank_code,
            #                             'bank_number': bank_number,
            #                             'bank_holder': bank_holder,
            #                             'api_key': self.api_key
            #                         }, 
            #                         timeout=10)
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
        실제 API 연동 시 이 메서드는 제거하고 위의 주석 처리된 API 호출 코드 사용
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
            ]),
            # 덕챗 테스트용 특수 케이스 - '1111'이 포함된 계좌번호
            ('004', '1111', [
                {
                    'report_date': '2024-11-15',
                    'report_type': '입금 후 연락두절',
                    'amount': 150000,
                    'description': '상품을 보내지 않고 연락이 되지 않습니다.',
                    'status': '확인됨'
                },
                {
                    'report_date': '2024-11-10',
                    'report_type': '가짜 상품 판매',
                    'amount': 89000,
                    'description': '정품이라고 했는데 가짜 상품을 보냈습니다.',
                    'status': '조사중'
                }
            ])
        ]
        
        # ✅ 해당 계좌의 신고 이력 찾기 - 계좌번호 정규화
        clean_bank = bank_number.replace('-', '').replace(' ', '')
        
        # 완전 일치 확인 - 은행코드가 없으면 계좌번호만으로 조회
        for fraud_bank, fraud_bank, reports in fraud_banks:
            clean_fraud_bank = fraud_bank.replace('-', '').replace(' ', '')
            # 은행코드가 있으면 둘 다 체크, 없으면 계좌번호만 체크
            if clean_fraud_bank == clean_bank:
                if not bank_code or fraud_bank == bank_code:
                    return {
                        'has_reports': True,
                        'report_count': len(reports),
                        'reports': reports,
                        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    }
        
        # 부분 일치 확인 (덕챗 뷰에서 '1111' in bank_number 패턴 지원)
        for fraud_bank, fraud_bank, reports in fraud_banks:
            clean_fraud_bank = fraud_bank.replace('-', '').replace(' ', '')
            if clean_fraud_bank in clean_bank:
                if not bank_code or fraud_bank == bank_code:
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
    
    # 덕챗 패턴 테스트 ('1111' 포함)
    print("\n❌ 덕챗 패턴 테스트:")
    result = service.check_bank_fraud_history('004', '1111567890', '테스트')
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
    test_dutcheat_service()