import requests
import time
from django.contrib.auth import get_user_model
from abc import ABC, abstractmethod
from accounts.models import SocialAccount

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
       """SocialAccount 모델을 사용한 사용자 생성 또는 조회"""
       social_id = user_data['social_id']
       email = user_data['email']
       nickname = user_data['nickname']
       
       # 1. SocialAccount로 기존 사용자 찾기
       try:
           social_account = SocialAccount.objects.get(
               provider=self.provider_name,
               social_id=social_id
           )
           return social_account.user
       except SocialAccount.DoesNotExist:
           pass
       
       # 2. 이메일로 기존 사용자 찾기 (일반 계정과 충돌 방지)
       if email and not email.endswith('.local'):
           existing_user = User.objects.filter(email=email).first()
           if existing_user:
               existing_social = SocialAccount.objects.filter(
                   user=existing_user, 
                   provider=self.provider_name
               ).first()
               if existing_social:
                   raise Exception(f'이미 {email}로 가입된 계정이 있습니다.')
               else:
                   # 기존 사용자에 소셜 계정 연결
                   SocialAccount.objects.create(
                       user=existing_user,
                       provider=self.provider_name,
                       social_id=social_id,
                       signup_completed=True
                   )
                   return existing_user
       
       # 3. 새 사용자 생성
       username = self._generate_username_from_email(
           email or f'{self.provider_name}_{social_id}@example.com'
       )
       
       user = User.objects.create_user(
           username=username,
           email=email or self._generate_unique_email(social_id),
           password=None,
           is_active=True,
           is_profile_completed=False
       )
       
       # SocialAccount 생성
       SocialAccount.objects.create(
           user=user,
           provider=self.provider_name,
           social_id=social_id,
           signup_completed=False
       )
       
       return user
   
   def _generate_username_from_email(self, email):
       """이메일을 기반으로 고유한 username 생성"""
       base_username = email.split('@')[0]
       base_username = ''.join(c for c in base_username if c.isalnum())
       
       if len(base_username) > 15:
           base_username = base_username[:15]
       
       if len(base_username) < 3:
           base_username = f'{self.provider_name}user'
       
       username = base_username
       counter = 1
       while User.objects.filter(username=username).exists():
           suffix = str(counter)
           max_base_length = 20 - len(suffix)
           username = f"{base_username[:max_base_length]}{suffix}"
           counter += 1
           
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
            token_data = self.exchange_code_for_token(code, state)
            access_token = token_data.get('access_token')
            
            if not access_token:
                raise Exception('액세스 토큰 발급 실패')
            
            user_info = self.get_user_info(access_token)
            user_data = self.extract_user_data(user_info)
            user = self.create_or_get_user(user_data)
            
            return user
            
        except Exception as e:
            # 더 구체적인 에러 메시지 전달
            raise Exception(str(e))