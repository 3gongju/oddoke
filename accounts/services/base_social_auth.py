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
       
       print(f"🔍 사용자 생성/조회 시작:")
       print(f"   Social ID: {social_id}")
       print(f"   Email: {email}")
       print(f"   Nickname: {nickname}")
       print(f"   Provider: {self.provider_name}")
       
       # 1. SocialAccount로 기존 사용자 찾기
       try:
           social_account = SocialAccount.objects.get(
               provider=self.provider_name,
               social_id=social_id
           )
           print(f"✅ 기존 SocialAccount 찾음: {social_account.user.username}")
           return social_account.user
       except SocialAccount.DoesNotExist:
           print("🔍 기존 SocialAccount 없음, 계속 진행...")
           pass
       
       # 2. 이메일로 기존 사용자 찾기 (일반 계정과 충돌 방지)
       if email and not email.endswith('.local'):
           print(f"🔍 이메일로 기존 사용자 검색: {email}")
           existing_user = User.objects.filter(email=email).first()
           if existing_user:
               print(f"🔍 기존 사용자 발견: {existing_user.username}")
               
               # 기존 사용자에게 이미 다른 소셜 계정이 연결되어 있는지 확인
               existing_social = SocialAccount.objects.filter(
                   user=existing_user
               ).first()
               
               if existing_social and existing_social.provider != self.provider_name:
                   print(f"❌ 이미 다른 소셜 계정({existing_social.provider})과 연결됨")
                   raise Exception(f'이미 {existing_social.get_provider_display()}로 가입된 계정입니다.')
               elif existing_social and existing_social.provider == self.provider_name:
                   print(f"✅ 같은 provider로 이미 연결됨, 업데이트")
                   existing_social.social_id = social_id
                   existing_social.save()
                   return existing_user
               else:
                   print(f"🔧 기존 사용자에 새 소셜 계정 연결")
                   # 기존 사용자에 소셜 계정 연결
                   SocialAccount.objects.create(
                       user=existing_user,
                       provider=self.provider_name,
                       social_id=social_id,
                       signup_completed=True  # 이미 완성된 계정
                   )
                   return existing_user
       
       # 3. 새 사용자 생성
       print("🔧 새 사용자 생성 시작...")
       
       # ✅ 이메일이 없거나 로컬 이메일인 경우 고유 이메일 생성
       if not email or email.endswith('.local'):
           email = self._generate_unique_email(social_id)
           print(f"🔧 고유 이메일 생성: {email}")
       
       username = self._generate_username_from_email(email)
       print(f"🔧 생성할 username: {username}")
       
       try:
           user = User.objects.create_user(
               username=username,
               email=email,
               password=None,  # 소셜 로그인은 비밀번호 없음
               is_active=True,
               is_profile_completed=False  # 프로필 완성 필요
           )
           print(f"✅ 새 사용자 생성 완료: {user.username}")
           
           # SocialAccount 생성
           social_account = SocialAccount.objects.create(
               user=user,
               provider=self.provider_name,
               social_id=social_id,
               signup_completed=False  # 추가 정보 입력 필요
           )
           print(f"✅ SocialAccount 생성 완료: {social_account}")
           
           return user
           
       except Exception as e:
           print(f"❌ 사용자 생성 실패: {e}")
           raise Exception(f'사용자 생성 중 오류가 발생했습니다: {str(e)}')
   
   def _generate_username_from_email(self, email):
       """이메일을 기반으로 고유한 username 생성"""
       print(f"🔧 Username 생성 시작: {email}")
       
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
       
       print(f"✅ 최종 username: {username}")
       return username
   
   def _generate_unique_email(self, social_id):
       """고유한 이메일 주소 생성"""
       timestamp = int(time.time())
       unique_email = f'{self.provider_name}_{social_id}_{timestamp}@{self.provider_name}.local'
       print(f"🔧 고유 이메일 생성: {unique_email}")
       return unique_email
   
   def handle_callback(self, code, state=None):
        """콜백 처리 전체 플로우"""
        print(f"🔍 {self.provider_name.upper()} 콜백 처리 시작...")
        
        try:
            print("1️⃣ 토큰 교환 중...")
            token_data = self.exchange_code_for_token(code, state)
            access_token = token_data.get('access_token')
            
            if not access_token:
                raise Exception('액세스 토큰 발급 실패')
            print(f"✅ 액세스 토큰 획득: {access_token[:20]}...")
            
            print("2️⃣ 사용자 정보 조회 중...")
            user_info = self.get_user_info(access_token)
            print(f"✅ 사용자 정보 수신: {list(user_info.keys())}")
            
            print("3️⃣ 사용자 데이터 추출 중...")
            user_data = self.extract_user_data(user_info)
            print(f"✅ 데이터 추출 완료: {user_data}")
            
            print("4️⃣ 사용자 생성/조회 중...")
            user = self.create_or_get_user(user_data)
            print(f"✅ 최종 사용자: {user.username} (ID: {user.id})")
            
            return user
            
        except Exception as e:
            print(f"❌ {self.provider_name.upper()} 콜백 처리 실패: {e}")
            # 더 구체적인 에러 메시지 전달
            raise Exception(str(e))