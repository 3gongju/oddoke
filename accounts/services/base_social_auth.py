import requests
import time
from django.contrib.auth import get_user_model
from django.contrib import messages
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
        """사용자 생성 또는 기존 사용자 반환"""
        social_id = user_data['social_id']
        email = user_data['email']
        nickname = user_data['nickname']
        name = user_data.get('name', '')
        
        # 🔥 임시 username 생성 (나중에 사용자가 변경할 예정)
        temp_username = f'temp_{self.provider_name}_{social_id}'
        user = None
        
        # 1. 임시 username으로 기존 사용자 찾기
        try:
            user = User.objects.get(username=temp_username)
            # 기존 사용자 정보 업데이트 (필요시)
            if self._should_update_nickname(user, nickname):
                # 임시 사용자는 username 업데이트하지 않음
                pass  # 사용자가 직접 설정할 때까지 대기
                
        except User.DoesNotExist:
            # 2. 이메일로 기존 사용자 찾기 (이메일이 있는 경우)
            if email and not email.endswith('.local'):
                try:
                    user = User.objects.get(email=email)
                    # 🔥 기존 일반 계정을 소셜 계정으로 연결하지 않음
                    # 대신 새 계정 생성 (이메일 중복 방지 처리)
                    user = None  # 새 계정 생성하도록 설정
                except User.DoesNotExist:
                    pass
            
            # 3. 새 사용자 생성
            if not user:
                user = self._create_new_temp_user(temp_username, email, nickname, name, social_id)
        
        return user
    
    def _should_update_nickname(self, user, new_nickname):
        """닉네임을 업데이트해야 하는지 판단"""
        if not user.username or user.is_temp_username:
            return True
        
        # 기본값 패턴인 경우 업데이트
        default_patterns = [
            f'{self.provider_name}_user_',
            'kakao_user_',
            'naver_user_'
        ]
        
        for pattern in default_patterns:
            if user.username.startswith(pattern):
                return True
        
        return False
    
    def _create_new_temp_user(self, temp_username, email, nickname, name, social_id):
        """새 소셜 사용자 생성 (임시 username으로)"""
        # 실제 이메일이 있으면 우선 사용, 없으면 고유한 이메일 생성
        if not email or email.endswith('.local'):
            email = self._generate_unique_email(social_id)
        else:
            email = self._ensure_unique_email(email)
        
        try:
            user = User.objects.create_user(
                username=temp_username,  # 🔥 임시 username
                email=email,
                password=None  # 소셜 로그인은 비밀번호 없음
            )
            # 🔥 소셜 로그인 관련 플래그 설정
            user.is_temp_username = True  # 임시 사용자명 표시
            user.social_signup_completed = False  # 아직 가입 완료 안 됨
            user.is_active = True  # 소셜 로그인 사용자는 바로 활성화
            user.save()
            return user
            
        except Exception as e:
            # 마지막 수단: 완전히 고유한 정보로 재시도
            unique_temp_username = f'temp_{self.provider_name}_{social_id}_{int(time.time())}'
            unique_email = self._generate_unique_email(social_id, force_unique=True)
            user = User.objects.create_user(
                username=unique_temp_username,
                email=unique_email,
                password=None
            )
            user.is_temp_username = True
            user.social_signup_completed = False
            user.is_active = True
            user.save()
            return user
    
    def _generate_unique_email(self, social_id, force_unique=False):
        """고유한 이메일 주소 생성"""
        if force_unique:
            timestamp = int(time.time())
            hash_value = hash(str(social_id)) % 10000
            return f'{self.provider_name}_{social_id}_{timestamp}_{hash_value}@{self.provider_name}.local'
        else:
            timestamp = int(time.time())
            return f'{self.provider_name}_{social_id}_{timestamp}@{self.provider_name}.local'
    
    def _ensure_unique_email(self, email):
        """기존 이메일이 중복되지 않도록 보장"""
        original_email = email
        counter = 1
        
        while User.objects.filter(email=email).exists():
            if '@' in original_email:
                name_part, domain = original_email.split('@', 1)
                email = f'{name_part}_{counter}@{domain}'
            else:
                email = f'{original_email}_{counter}'
            
            counter += 1
            if counter > 10:  # 무한루프 방지
                return self._generate_unique_email(email, force_unique=True)
        
        return email
    
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