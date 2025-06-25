import requests
import time
from django.contrib.auth import get_user_model
from abc import ABC, abstractmethod

User = get_user_model()

class BaseSocialAuthService(ABC):
    """소셜 로그인 공통 기능을 제공하는 추상 클래스"""
    
    def __init__(self):
        self.client_id = None
        self.client_secret = None
        self.redirect_uri = None
        self.provider_name = None
    
    @abstractmethod
    def get_auth_url(self, state=None):
        """소셜 로그인 인증 URL 생성"""
        pass
    
    @abstractmethod
    def exchange_code_for_token(self, code, state=None):
        """인증 코드를 액세스 토큰으로 교환"""
        pass
    
    @abstractmethod
    def get_user_info(self, access_token):
        """액세스 토큰으로 사용자 정보 조회"""
        pass
    
    @abstractmethod
    def extract_user_data(self, user_info):
        """소셜 플랫폼별 사용자 정보 파싱"""
        pass
    
    def create_or_get_user(self, user_data):
        """사용자 생성 또는 기존 사용자 반환 - 간소화된 버전"""
        social_id = user_data['social_id']
        email = user_data['email']
        nickname = user_data['nickname']
        
        print(f"🔍 소셜 로그인 처리: {self.provider_name}_id = {social_id}")
        
        # 🔥 1. 소셜 ID로 기존 사용자 찾기
        social_id_field = f'{self.provider_name}_id'
        try:
            user = User.objects.get(**{social_id_field: social_id})
            print(f"✅ 기존 소셜 사용자 찾음: {user.username}")
            return user
        except User.DoesNotExist:
            pass
        
        # 🔥 2. 이메일로 기존 사용자 찾기 (일반 계정과 충돌 방지)
        if email and not email.endswith('.local'):
            if User.objects.filter(email=email).exclude(**{social_id_field + '__isnull': True}).exists():
                raise Exception(f'이미 {email}로 가입된 계정이 있습니다.')
        
        # 🔥 3. 새 사용자 생성 (바로 사용 가능한 username으로)
        username = self._generate_username_from_email(email or f'{self.provider_name}_{social_id}@example.com')
        
        user = User.objects.create_user(
            username=username,
            email=email or self._generate_unique_email(social_id),
            password=None,
            is_active=True,
            social_signup_completed=False  # 🔥 추가 정보 입력 필요
        )
        
        # 🔥 소셜 ID 저장
        setattr(user, social_id_field, social_id)
        user.save()
        
        print(f"✅ 새 소셜 사용자 생성: {username}")
        return user
    
    def _generate_username_from_email(self, email):
        """이메일을 기반으로 고유한 username 생성"""
        base_username = email.split('@')[0]
        # 특수문자 제거, 영숫자만 남기기
        base_username = ''.join(c for c in base_username if c.isalnum())
        
        # 너무 긴 경우 자르기
        if len(base_username) > 15:
            base_username = base_username[:15]
        
        # 너무 짧은 경우 처리
        if len(base_username) < 3:
            base_username = f'{self.provider_name}user'
        
        # 중복 확인 및 고유화
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            suffix = str(counter)
            max_base_length = 20 - len(suffix)
            username = f"{base_username[:max_base_length]}{suffix}"
            counter += 1
            
            # 무한루프 방지
            if counter > 9999:
                username = f"{self.provider_name}{int(time.time())}"
                break
        
        return username
    
    def _generate_unique_email(self, social_id):
        """고유한 이메일 주소 생성"""
        timestamp = int(time.time())
        return f'{self.provider_name}_{social_id}_{timestamp}@{self.provider_name}.local'
    
    def handle_callback(self, code, state=None):
        """콜백 처리 전체 플로우"""
        try:
            # 1. 토큰 교환
            token_data = self.exchange_code_for_token(code, state)
            access_token = token_data.get('access_token')
            
            if not access_token:
                raise Exception('액세스 토큰 발급 실패')
            
            # 2. 사용자 정보 조회
            user_info = self.get_user_info(access_token)
            
            # 3. 사용자 데이터 추출
            user_data = self.extract_user_data(user_info)
            
            # 4. 사용자 생성 또는 조회
            user = self.create_or_get_user(user_data)
            
            return user
            
        except requests.RequestException as e:
            raise Exception(f'{self.provider_name} 서버와의 통신 중 오류가 발생했습니다.')
        except Exception as e:
            raise Exception(f'{self.provider_name} 로그인 처리 중 오류가 발생했습니다: {str(e)}')
