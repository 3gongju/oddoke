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
    
    def get_auth_url(self, state=None):
        return (
            f"https://kauth.kakao.com/oauth/authorize"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope=profile_nickname,account_email"
        )
    
    def exchange_code_for_token(self, code, state=None):
        token_url = 'https://kauth.kakao.com/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri,
            'code': code,
        }
        
        response = requests.post(token_url, data=token_data)
        response.raise_for_status()
        return response.json()
    
    def get_user_info(self, access_token):
        user_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        response = requests.get(user_url, headers=headers)
        response.raise_for_status()
        return response.json()
    
    def extract_user_data(self, user_info):
        kakao_id = str(user_info.get('id'))
        kakao_account = user_info.get('kakao_account', {})
        profile = kakao_account.get('profile', {})
        
        email = kakao_account.get('email')
        nickname = profile.get('nickname') or f'kakao_{kakao_id}'
        
        return {
            'social_id': kakao_id,
            'email': email,
            'nickname': nickname,
            'provider': 'kakao'
        }
    
    def get_logout_url(self, logout_redirect_uri=None):
        if not logout_redirect_uri:
            logout_redirect_uri = os.getenv('KAKAO_OAUTH_LOGOUT_REDIRECT_URI', '/')
        
        return (
            f"https://kauth.kakao.com/oauth/logout"
            f"?client_id={self.client_id}"
            f"&logout_redirect_uri={logout_redirect_uri}"
        )

    