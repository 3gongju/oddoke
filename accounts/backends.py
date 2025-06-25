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
        print(f"   password: {'있음' if password else 'None'}")
        print(f"   username: {username}")
        
        # 🔥 일반 이메일 로그인: 이메일 + 패스워드 (우선순위 1)
        if email and password:
            print("🔍 일반 이메일 로그인 시도")
            try:
                user = UserModel.objects.get(email=email)
                print(f"🔍 찾은 사용자: {user.username}")
                
                # 비밀번호 확인
                if user.check_password(password):
                    print("✅ 일반 이메일 로그인 성공")
                    return user
                else:
                    print("❌ 비밀번호 불일치")
                    return None
            except UserModel.DoesNotExist:
                print("❌ 해당 이메일의 사용자 없음")
                return None
        
        # 🔥 소셜 로그인: 이메일만 있고 패스워드가 None인 경우 (우선순위 2)
        elif email and password is None:
            print("🔍 소셜 로그인 인증 시도")
            try:
                user = UserModel.objects.get(email=email)
                print(f"🔍 찾은 사용자: {user.username}")
                print(f"🔍 소셜 가입 완료: {getattr(user, 'social_signup_completed', False)}")
                print(f"🔍 임시 사용자명: {getattr(user, 'is_temp_username', False)}")
                print(f"🔍 카카오 ID: {getattr(user, 'kakao_id', 'None')}")
                print(f"🔍 네이버 ID: {getattr(user, 'naver_id', 'None')}")
                print(f"🔍 구글 ID: {getattr(user, 'google_id', 'None')}")

                
                
                
                # 🔥 소셜 로그인 사용자 확인 조건
                is_temp_social = user.username.startswith(('temp_kakao_', 'temp_naver_', 'temp_google_'))
                is_completed_social = getattr(user, 'social_signup_completed', False)
                has_social_id = (getattr(user, 'kakao_id', None) is not None or 
                                getattr(user, 'naver_id', None) is not None or
                                getattr(user, 'google_id', None) is not None)
                
                
                if is_temp_social or is_completed_social or has_social_id:
                    print("✅ 소셜 로그인 사용자 인증 성공")
                    return user
                else:
                    print("❌ 일반 사용자이므로 소셜 로그인 불가")
                    return None
            except UserModel.DoesNotExist:
                print("❌ 해당 이메일의 사용자 없음")
                return None
        
        # 🔥 username 기반 로그인도 지원 (기존 호환성)
        elif username and password:
            print("🔍 username 로그인 시도")
            try:
                user = UserModel.objects.get(username=username)
                if user.check_password(password):
                    print("✅ username 로그인 성공")
                    return user
                else:
                    print("❌ 비밀번호 불일치")
                    return None
            except UserModel.DoesNotExist:
                print("❌ 해당 username의 사용자 없음")
                return None
        
        print("❌ 모든 인증 방법 실패")
        return None