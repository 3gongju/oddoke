import os
import requests
from dotenv import load_dotenv
from .base_social_auth import BaseSocialAuthService

load_dotenv()


class GoogleAuthService(BaseSocialAuthService):
    """구글 소셜 로그인 서비스"""
    
    def __init__(self):
        super().__init__()
        self.client_id = os.getenv('GOOGLE_OAUTH_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_OAUTH_SECRET_ID')
        self.redirect_uri = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')
        self.provider_name = 'google'
    
    def get_auth_url(self, state=None):
        """구글 로그인 인증 URL 생성"""
        auth_url = (
            f"https://accounts.google.com/o/oauth2/auth"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope=openid email profile"
            f"&response_type=code"
            f"&access_type=offline"
            f"&prompt=consent"
        )
        return auth_url
    
    def exchange_code_for_token(self, code, state=None):
        """구글 인증 코드를 액세스 토큰으로 교환"""
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri,
            'code': code,
        }
        
        response = requests.post(token_url, data=token_data)
        response.raise_for_status()
        
        token_json = response.json()
        
        if 'access_token' not in token_json:
            raise Exception('구글 토큰 발급에 실패했습니다.')
        
        return token_json
    
    def get_user_info(self, access_token):
        """구글 액세스 토큰으로 사용자 정보 조회"""
        user_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        response = requests.get(user_url, headers=headers)
        response.raise_for_status()
        
        return response.json()
    
    def extract_user_data(self, user_info):
        """구글 사용자 정보에서 필요한 데이터 추출"""
        google_id = user_info.get('id')
        email = user_info.get('email')
        name = user_info.get('name', '')
        
        # 닉네임 우선순위: name -> email 앞부분 -> 기본값
        nickname = name
        if not nickname and email:
            nickname = email.split('@')[0]
        if not nickname:
            nickname = f'google_user_{google_id}'
        
        return {
            'social_id': google_id,
            'email': email,
            'nickname': nickname,
            'name': name,
            'provider': 'google'
        }
    
    def get_logout_url(self, logout_redirect_uri=None):
        """구글 로그아웃 URL 생성"""
        if not logout_redirect_uri:
            logout_redirect_uri = os.getenv('GOOGLE_OAUTH_LOGOUT_REDIRECT_URI', '/')
        
        logout_url = (
            f"https://accounts.google.com/logout"
            f"?continue={logout_redirect_uri}"
        )
        return logout_url