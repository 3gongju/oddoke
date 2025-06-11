import os
import requests
from dotenv import load_dotenv
from .base_social_auth import BaseSocialAuthService

load_dotenv()


class KakaoAuthService(BaseSocialAuthService):
    """카카오 소셜 로그인 서비스"""
    
    def __init__(self):
        super().__init__()
        self.client_id = os.getenv('KAKAO_REST_API_KEY')
        self.client_secret = os.getenv('KAKAO_OAUTH_SECRET_ID')
        self.redirect_uri = os.getenv('KAKAO_OAUTH_REDIRECT_URI')
        self.provider_name = 'kakao'
    
    def get_auth_url(self, state=None):
        """카카오 로그인 인증 URL 생성"""
        auth_url = (
            f"https://kauth.kakao.com/oauth/authorize"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope=profile_nickname"
            f"&prompt=login"
        )
        return auth_url
    
    def exchange_code_for_token(self, code, state=None):
        """카카오 인증 코드를 액세스 토큰으로 교환"""
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
        
        token_json = response.json()
        
        if 'access_token' not in token_json:
            raise Exception('카카오 토큰 발급에 실패했습니다.')
        
        return token_json
    
    def get_user_info(self, access_token):
        """카카오 액세스 토큰으로 사용자 정보 조회"""
        user_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        response = requests.get(user_url, headers=headers)
        response.raise_for_status()
        
        return response.json()
    
    def extract_user_data(self, user_info):
        """카카오 사용자 정보에서 필요한 데이터 추출"""
        kakao_id = user_info.get('id')
        kakao_account = user_info.get('kakao_account', {})
        profile = kakao_account.get('profile', {})
        
        # 이메일 추출
        email = kakao_account.get('email')
        
        # 닉네임 추출 (여러 경로 시도)
        nickname = None
        if profile and 'nickname' in profile:
            nickname = profile['nickname']
        else:
            properties = user_info.get('properties', {})
            nickname = properties.get('nickname')
        
        # 기본 닉네임 설정
        if not nickname:
            nickname = f'kakao_user_{kakao_id}'
        
        return {
            'social_id': kakao_id,
            'email': email,
            'nickname': nickname,
            'name': None,  # 카카오는 실명 정보 제공 안 함
            'provider': 'kakao'
        }
    
    def get_logout_url(self, logout_redirect_uri=None):
        """카카오 로그아웃 URL 생성"""
        if not logout_redirect_uri:
            logout_redirect_uri = os.getenv('KAKAO_OAUTH_LOGOUT_REDIRECT_URI')
        
        logout_url = (
            f"https://kauth.kakao.com/oauth/logout"
            f"?client_id={self.client_id}"
            f"&logout_redirect_uri={logout_redirect_uri}"
        )
        return logout_url