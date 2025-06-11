# backends.py
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

UserModel = get_user_model()

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, email=None, password=None, **kwargs):
        """
        이메일 기반 인증 백엔드
        - 일반 로그인: 이메일 + 패스워드
        - 소셜 로그인: 이메일만 (패스워드 없음)
        """
        print(f"🔍 EmailBackend 인증 시도:")
        print(f"   email: {email}")
        print(f"   password: {password}")
        print(f"   username: {username}")
        
        # 소셜 로그인: 이메일만 있고 패스워드가 None인 경우
        if email and password is None:
            print("🔍 소셜 로그인 인증 시도")
            try:
                user = UserModel.objects.get(email=email)
                print(f"🔍 찾은 사용자: {user.username}")
                print(f"🔍 임시 사용자명: {getattr(user, 'is_temp_username', False)}")
                # 소셜 로그인 사용자 확인 (username이 temp_로 시작)
                if user.username.startswith(('temp_kakao_', 'temp_naver_')):
                    print("✅ 소셜 로그인 사용자 인증 성공")
                    return user
                else:
                    print("❌ 일반 사용자이므로 소셜 로그인 불가")
                    return None
            except UserModel.DoesNotExist:
                print("❌ 해당 이메일의 사용자 없음")
                return None
        
        # 일반 이메일 로그인: 이메일 + 패스워드
        elif email and password:
            print("🔍 일반 이메일 로그인 시도")
            try:
                user = UserModel.objects.get(email=email)
                if user.check_password(password):
                    print("✅ 일반 로그인 성공")
                    return user
                else:
                    print("❌ 비밀번호 불일치")
            except UserModel.DoesNotExist:
                print("❌ 해당 이메일의 사용자 없음")
                return None
        
        # username 기반 로그인도 지원 (기존 호환성)
        elif username and password:
            print("🔍 username 로그인 시도")
            try:
                user = UserModel.objects.get(username=username)
                if user.check_password(password):
                    print("✅ username 로그인 성공")
                    return user
                else:
                    print("❌ 비밀번호 불일치")
            except UserModel.DoesNotExist:
                print("❌ 해당 username의 사용자 없음")
                return None
        
        print("❌ 모든 인증 방법 실패")
        return None