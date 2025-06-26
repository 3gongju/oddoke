import os
import uuid
import requests
from dotenv import load_dotenv
from .base_social_auth import BaseSocialAuthService

load_dotenv()

class NaverAuthService(BaseSocialAuthService):
    def __init__(self):
        super().__init__()
        self.client_id = os.getenv('NAVER_OAUTH_CLIENT_ID')
        self.client_secret = os.getenv('NAVER_OAUTH_SECRET_ID')
        self.redirect_uri = os.getenv('NAVER_OAUTH_REDIRECT_URI')
        self.provider_name = 'naver'
        
        print(f"🔍 Naver Service 초기화:")
        print(f"   Client ID: {self.client_id}")
        print(f"   Redirect URI: {self.redirect_uri}")
    
    def get_auth_url(self, state=None):
        if not state:
            state = uuid.uuid4().hex
        
        auth_url = (
            f"https://nid.naver.com/oauth2.0/authorize"
            f"?response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={state}"
        )
        
        print(f"🔍 네이버 Auth URL: {auth_url}")
        return auth_url, state
    
    def exchange_code_for_token(self, code, state=None):
        token_url = 'https://nid.naver.com/oauth2.0/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'state': state,
        }
        
        print(f"🔍 네이버 토큰 교환 요청:")
        print(f"   URL: {token_url}")
        print(f"   Code: {code[:20]}...")
        print(f"   State: {state}")
        
        try:
            response = requests.post(token_url, data=token_data, timeout=30)
            
            print(f"🔍 토큰 응답 상태: {response.status_code}")
            print(f"🔍 토큰 응답 내용: {response.text}")
            
            if response.status_code != 200:
                raise Exception(f"토큰 교환 실패: {response.text}")
            
            token_data = response.json()
            print(f"✅ 토큰 교환 성공: {list(token_data.keys())}")
            return token_data
            
        except Exception as e:
            print(f"❌ 네이버 토큰 교환 오류: {e}")
            raise
    
    def get_user_info(self, access_token):
        user_url = 'https://openapi.naver.com/v1/nid/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        print(f"🔍 네이버 사용자 정보 요청:")
        print(f"   URL: {user_url}")
        print(f"   Token: {access_token[:20]}...")
        
        response = requests.get(user_url, headers=headers, timeout=30)
        
        print(f"🔍 사용자 정보 응답 상태: {response.status_code}")
        print(f"🔍 사용자 정보 응답: {response.text}")
        
        if response.status_code != 200:
            raise Exception(f"사용자 정보 조회 실패: {response.status_code}")
        
        user_info = response.json()
        print(f"✅ 사용자 정보 수신: {list(user_info.keys())}")
        return user_info
    
    def extract_user_data(self, user_info):
        response_data = user_info.get('response', {})
        
        # ✅ 수정: naver_id → social_id 통일
        naver_id = response_data.get('id')  # 네이버 고유 ID
        email = response_data.get('email')
        nickname = response_data.get('nickname') or f'naver_{naver_id}'
        
        print(f"🔍 네이버 사용자 데이터 추출:")
        print(f"   Naver ID: {naver_id}")
        print(f"   Email: {email}")
        print(f"   Nickname: {nickname}")
        
        # ✅ 이메일이 없는 경우를 대비한 고유 이메일 생성
        if not email or email == '':
            email = self._generate_unique_email(naver_id)
            print(f"🔧 생성된 고유 이메일: {email}")
        
        extracted_data = {
            'social_id': naver_id,  # ✅ 수정: naver_id → social_id
            'email': email,
            'nickname': nickname,
            'provider': 'naver'
        }
        
        print(f"✅ 최종 추출 데이터: {extracted_data}")
        return extracted_data
    
    def validate_state(self, request_state, session_state):
        is_valid = request_state == session_state if request_state and session_state else False
        print(f"🔍 State 검증: {is_valid} (요청: {request_state}, 세션: {session_state})")
        return is_valid