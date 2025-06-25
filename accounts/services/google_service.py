import os
import requests
from dotenv import load_dotenv
from .base_social_auth import BaseSocialAuthService

load_dotenv()

class GoogleAuthService(BaseSocialAuthService):
    def __init__(self):
        super().__init__()
        self.client_id = os.getenv('GOOGLE_OAUTH_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_OAUTH_SECRET_ID')
        self.redirect_uri = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')
        self.provider_name = 'google'
    
    def get_auth_url(self, state=None):
        return (
            f"https://accounts.google.com/o/oauth2/auth"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope=openid email profile"
            f"&response_type=code"
        )
    
    def exchange_code_for_token(self, code, state=None):
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
        return response.json()
    
    def get_user_info(self, access_token):
        user_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        response = requests.get(user_url, headers=headers)
        response.raise_for_status()
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
            logout_redirect_uri = os.getenv('GOOGLE_OAUTH_LOGOUT_REDIRECT_URI', '/')
        
        return f"https://accounts.google.com/logout?continue={logout_redirect_uri}"