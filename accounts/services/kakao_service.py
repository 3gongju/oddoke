import os
import requests
from dotenv import load_dotenv
from .base_social_auth import BaseSocialAuthService

load_dotenv()

class KakaoAuthService(BaseSocialAuthService):
    def __init__(self):
        super().__init__()
        self.client_id = os.getenv('KAKAO_REST_API_KEY')
        self.client_secret = os.getenv('KAKAO_OAUTH_SECRET_ID')
        self.redirect_uri = os.getenv('KAKAO_OAUTH_REDIRECT_URI')
        self.provider_name = 'kakao'
        
        print(f"🔍 Kakao Service 초기화:")
        print(f"   Client ID: {self.client_id}")
        print(f"   Redirect URI: {self.redirect_uri}")
    
    def get_auth_url(self, state=None):
        auth_url = (
            f"https://kauth.kakao.com/oauth/authorize"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope=profile_nickname,account_email"
        )
        print(f"🔍 카카오 Auth URL: {auth_url}")
        return auth_url
    
    def exchange_code_for_token(self, code, state=None):
        token_url = 'https://kauth.kakao.com/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri,
            'code': code,
        }
        
        print(f"🔍 카카오 토큰 교환 요청:")
        print(f"   URL: {token_url}")
        print(f"   Code: {code[:20]}...")
        
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
            print(f"❌ 카카오 토큰 교환 오류: {e}")
            raise
    
    def get_user_info(self, access_token):
        user_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        print(f"🔍 카카오 사용자 정보 요청:")
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
        # ✅ 수정: kakao_id → social_id 통일
        kakao_id = str(user_info.get('id'))  # 카카오 고유 ID
        kakao_account = user_info.get('kakao_account', {})
        profile = kakao_account.get('profile', {})
        
        email = kakao_account.get('email')
        nickname = profile.get('nickname') or f'kakao_{kakao_id}'
        
        print(f"🔍 카카오 사용자 데이터 추출:")
        print(f"   Kakao ID: {kakao_id}")
        print(f"   Email: {email}")
        print(f"   Nickname: {nickname}")
        
        # ✅ 이메일이 없는 경우를 대비한 고유 이메일 생성
        if not email or email == '':
            email = self._generate_unique_email(kakao_id)
            print(f"🔧 생성된 고유 이메일: {email}")
        
        extracted_data = {
            'social_id': kakao_id,  # ✅ 수정: kakao_id → social_id
            'email': email,
            'nickname': nickname,
            'provider': 'kakao'
        }
        
        print(f"✅ 최종 추출 데이터: {extracted_data}")
        return extracted_data
    
    def get_logout_url(self, logout_redirect_uri=None):
        if not logout_redirect_uri:
            logout_redirect_uri = os.getenv('KAKAO_OAUTH_LOGOUT_REDIRECT_URI', '/')
        
        return (
            f"https://kauth.kakao.com/oauth/logout"
            f"?client_id={self.client_id}"
            f"&logout_redirect_uri={logout_redirect_uri}"
        )

    
