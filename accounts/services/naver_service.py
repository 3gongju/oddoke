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
        
        response = requests.post(token_url, data=token_data)
        response.raise_for_status()
        return response.json()
    
    def get_user_info(self, access_token):
        user_url = 'https://openapi.naver.com/v1/nid/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        response = requests.get(user_url, headers=headers)
        response.raise_for_status()
        return response.json()
    
    def extract_user_data(self, user_info):
        response_data = user_info.get('response', {})
        
        naver_id = response_data.get('id')
        email = response_data.get('email')
        nickname = response_data.get('nickname') or f'naver_{naver_id}'
        
        return {
            'social_id': naver_id,
            'email': email,
            'nickname': nickname,
            'provider': 'naver'
        }
    
    def validate_state(self, request_state, session_state):
        return request_state == session_state if request_state and session_state else False
