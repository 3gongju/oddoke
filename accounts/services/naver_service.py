import os
import uuid
import requests
from dotenv import load_dotenv
from .base_social_auth import BaseSocialAuthService

load_dotenv()


class NaverAuthService(BaseSocialAuthService):
    """네이버 소셜 로그인 서비스"""
    
    def __init__(self):
        super().__init__()
        self.client_id = os.getenv('NAVER_OAUTH_CLIENT_ID')
        self.client_secret = os.getenv('NAVER_OAUTH_SECRET_ID')
        self.redirect_uri = os.getenv('NAVER_OAUTH_REDIRECT_URI')
        self.provider_name = 'naver'
    
    def get_auth_url(self, state=None):
        """네이버 로그인 인증 URL 생성"""
        if not state:
            state = uuid.uuid4().hex
        
        auth_url = (
            f"https://nid.naver.com/oauth2.0/authorize"
            f"?response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={state}"
            f"&auth_type=reauthenticate"
            f"&prompt=consent"
        )
        return auth_url, state
    
    def exchange_code_for_token(self, code, state=None):
        """네이버 인증 코드를 액세스 토큰으로 교환"""
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
        
        token_json = response.json()
        
        if 'access_token' not in token_json:
            raise Exception('네이버 토큰 발급에 실패했습니다.')
        
        return token_json
    
    def get_user_info(self, access_token):
        """네이버 액세스 토큰으로 사용자 정보 조회"""
        user_url = 'https://openapi.naver.com/v1/nid/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        response = requests.get(user_url, headers=headers)
        response.raise_for_status()
        
        user_json = response.json()
        
        # 네이버 API 응답 확인
        if user_json.get('resultcode') != '00':
            raise Exception('네이버 사용자 정보 조회에 실패했습니다.')
        
        return user_json
    
    def extract_user_data(self, user_info):
        """네이버 사용자 정보에서 필요한 데이터 추출"""
        response_data = user_info.get('response', {})
        
        naver_id = response_data.get('id')
        email = response_data.get('email')
        nickname = response_data.get('nickname', f'naver_user_{naver_id}')
        name = response_data.get('name', '')
        
        return {
            'social_id': naver_id,
            'email': email,
            'nickname': nickname,
            'name': name,
            'provider': 'naver'
        }
    
    def validate_state(self, request_state, session_state):
        """State 파라미터 검증 (CSRF 방지)"""
        if not request_state or not session_state:
            return False
        return request_state == session_state