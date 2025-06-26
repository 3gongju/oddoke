import requests
from django.conf import settings
from .base_social_auth import BaseSocialAuthService
import urllib.parse

class GoogleAuthService(BaseSocialAuthService):
    def __init__(self):
        super().__init__()
        self.client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        self.client_secret = settings.GOOGLE_OAUTH_SECRET_ID
        self.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
        self.provider_name = 'google'
        
        print(f"🔍 실제 사용할 Redirect URI: {self.redirect_uri}")
    
    def get_auth_url(self, state=None):
        # URL 파라미터를 안전하게 인코딩
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code'
        }
        
        # URL 인코딩
        query_string = urllib.parse.urlencode(params)
        auth_url = f"https://accounts.google.com/o/oauth2/auth?{query_string}"
        
        print(f"🔍 최종 Auth URL: {auth_url}")
        return auth_url
    
    def exchange_code_for_token(self, code, state=None):
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri,  # 정확히 동일한 URI 사용
            'code': code,
        }
        
        print(f"🔍 토큰 교환 시 사용하는 redirect_uri: {self.redirect_uri}")
        
        try:
            response = requests.post(token_url, data=token_data, timeout=30)
            
            if response.status_code != 200:
                print(f"❌ 토큰 교환 실패: {response.status_code}")
                print(f"❌ 응답 내용: {response.text}")
                raise Exception(f"토큰 교환 실패: {response.text}")
            
            return response.json()
            
        except Exception as e:
            print(f"❌ 토큰 교환 오류: {e}")
            raise
    
    def get_user_info(self, access_token):
        user_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        response = requests.get(user_url, headers=headers, timeout=30)
        if response.status_code != 200:
            raise Exception(f"사용자 정보 조회 실패: {response.status_code}")
        
        return response.json()
    
    def extract_user_data(self, user_info):
        google_id = user_info.get('id')
        email = user_info.get('email')
        name = user_info.get('name', '')
        
        nickname = name or (email.split('@')[0] if email else f'google_{google_id}')
        
        return {
            'social_id': google_id,
            'email': email,
            'nickname': nickname,
            'provider': 'google'
        }
    
    def get_logout_url(self, logout_redirect_uri=None):
        if not logout_redirect_uri:
            logout_redirect_uri = settings.GOOGLE_OAUTH_LOGOUT_REDIRECT_URI
        
        return f"https://accounts.google.com/logout?continue={logout_redirect_uri}"