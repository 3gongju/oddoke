# backends.py
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from accounts.models import SocialAccount  # ✅ 이 부분 반드시 필요

UserModel = get_user_model()

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, email=None, password=None, **kwargs):
        print(f"🔍 EmailBackend 인증 시도:")
        print(f"   email: {email}")
        print(f"   password: {'있음' if password else 'None'}")
        print(f"   username: {username}")

        if email and password:
            print("🔍 일반 이메일 로그인 시도")
            try:
                user = UserModel.objects.get(email=email)
                if user.check_password(password):
                    print("✅ 일반 이메일 로그인 성공")
                    return user
                else:
                    print("❌ 비밀번호 불일치")
            except UserModel.DoesNotExist:
                print("❌ 해당 이메일의 사용자 없음")
            return None

        elif email and password is None:
            print("🔍 소셜 로그인 인증 시도")
            try:
                user = UserModel.objects.get(email=email)
                is_temp_social = user.username.startswith(('temp_kakao_', 'temp_naver_', 'temp_google_'))
                is_completed_social = getattr(user, 'social_signup_completed', False)

                # ✅ SocialAccount 기반 소셜 로그인 판단
                has_social_account = SocialAccount.objects.filter(user=user).exists()

                if is_temp_social or is_completed_social or has_social_account:
                    print("✅ 소셜 로그인 사용자 인증 성공")
                    return user
                else:
                    print("❌ 일반 사용자이므로 소셜 로그인 불가")
            except UserModel.DoesNotExist:
                print("❌ 해당 이메일의 사용자 없음")
            return None

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
