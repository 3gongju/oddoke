import re
from django import forms
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import User, MannerReview, BankProfile, AddressProfile, PostReport, BannerRequest
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth import get_user_model

User = get_user_model()


class CustomPasswordResetForm(PasswordResetForm):
    email = forms.EmailField(
        label="이메일",
        max_length=254,
        widget=forms.EmailInput(attrs={
            'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '가입 시 사용한 이메일을 입력하세요',
            'autocomplete': 'email'
        })
    )
    
    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email:
            # 이메일 형식 검증
            if not User.objects.filter(email=email, is_active=True).exists():
                # 보안상 실제 에러는 표시하지 않고 폼은 유효하게 처리
                pass
        return email

class CustomSetPasswordForm(SetPasswordForm):
    new_password1 = forms.CharField(
        label="새 비밀번호",
        strip=False,
        widget=forms.PasswordInput(attrs={
            'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '새로운 비밀번호를 입력하세요',
            'autocomplete': 'new-password'
        }),
        help_text="8자 이상의 안전한 비밀번호를 사용하세요."
    )
    new_password2 = forms.CharField(
        label="새 비밀번호 확인",
        strip=False,
        widget=forms.PasswordInput(attrs={
            'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '새로운 비밀번호를 다시 입력하세요',
            'autocomplete': 'new-password'
        })
    )

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={
            'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '이메일을 입력하세요'
        })
    )
    
    username = forms.CharField(
        max_length=20,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '다른 사용자들에게 보여질 닉네임을 입력하세요'
        })
    )
    
    password1 = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '비밀번호를 입력하세요'
        })
    )
    
    password2 = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '비밀번호를 다시 입력하세요'
        })
    )
    
    # 프로필 이미지 필드
    profile_image = forms.ImageField(
        required=False,
        widget=forms.FileInput(attrs={
            'accept': 'image/*',
            'style': 'position: absolute; left: -9999px; opacity: 0;'
        }),
        help_text='프로필 이미지를 설정해주세요. (선택사항)'
    )
    
    class Meta():
        model = User
        fields = ['username', 'email', 'password1', 'password2', 'profile_image']

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("이미 사용 중인 이메일입니다.")
        return email

    def clean_username(self):
        username = self.cleaned_data.get('username')
        if not username:
            raise forms.ValidationError("닉네임을 입력해주세요.")
        
        # 앞뒤 공백 제거
        username = username.strip()
        
        # 길이 검증
        if len(username) < 2:
            raise forms.ValidationError("닉네임은 최소 2자 이상이어야 합니다.")
        
        if len(username) > 20:
            raise forms.ValidationError("닉네임은 최대 20자까지 입력 가능합니다.")
        
        # 공백 관련 검증
        if username.startswith(' ') or username.endswith(' '):
            raise forms.ValidationError("닉네임 앞뒤에 공백은 사용할 수 없습니다.")
        
        # 연속된 공백 금지
        if '  ' in username:  # 공백 2개 이상 연속
            raise forms.ValidationError("연속된 공백은 사용할 수 없습니다.")
        
        # 한글, 영문, 숫자, 단일 공백만 허용
        import re
        if not re.match(r'^[가-힣a-zA-Z0-9\s]+$', username):
            raise forms.ValidationError("닉네임은 한글, 영문, 숫자, 공백만 사용 가능합니다.")
        
        # 임시 username 패턴 금지
        if username.startswith(('temp_kakao_', 'temp_naver_')):
            raise forms.ValidationError("사용할 수 없는 닉네임 형식입니다.")
        
        # 기존 username 중복 검사
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError("이미 사용 중인 닉네임입니다.")
        
        return username

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")

        if password1 and password2 and password1 != password2:
            self.add_error('password2', "비밀번호가 일치하지 않습니다.")
        
        return cleaned_data

    def save(self, commit=True):
        """ 프로필 이미지 처리 추가된 save 메서드"""
        user = super().save(commit=False)
        user.is_active = False  # 이메일 인증 전까지 비활성화
        user.is_profile_completed = False
        
        # 프로필 이미지 처리
        if self.cleaned_data.get('profile_image'):
            user.profile_image = self.cleaned_data['profile_image']
            
        if commit:
            user.save()
        return user

# 이메일 로그인폼
class EmailAuthenticationForm(forms.Form):
    email = forms.EmailField(
        label="이메일",
        widget=forms.EmailInput(attrs={
            'class': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-500',
            'placeholder': '이메일을 입력하세요'
        })
    )
    password = forms.CharField(
        label="비밀번호",
        widget=forms.PasswordInput(attrs={
            'class': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-500',
            'placeholder': '비밀번호를 입력하세요'
        })
    )

    def clean(self):
        email = self.cleaned_data.get('email')
        password = self.cleaned_data.get('password')

        if email and password:
            self.user = authenticate(email=email, password=password)
            if self.user is None:
                raise forms.ValidationError("이메일 또는 비밀번호가 올바르지 않습니다.")
        return self.cleaned_data

    def get_user(self):
        return self.user

# 소셜 로그인 후 추가 정보 입력 폼
class SocialSignupCompleteForm(forms.ModelForm):   
    username = forms.CharField(
        max_length=20,
        label="닉네임",
        widget=forms.TextInput(attrs={
            'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '다른 사용자들에게 보여질 닉네임을 입력하세요',
            'required': True
        }),
        help_text="2-20자의 한글, 영문, 숫자를 사용할 수 있습니다."
    )
    
    profile_image = forms.ImageField(
        required=False,
        label="프로필 이미지",
        widget=forms.FileInput(attrs={
            'class': 'hidden',
            'accept': 'image/*',
            'id': 'profile-image-input'
        }),
        help_text="프로필 이미지를 설정해주세요."
    )
    
    class Meta:
        model = User
        fields = ['username', 'profile_image']  # 🔥 bio 제거
    
    def clean_username(self):
        username = self.cleaned_data.get('username')
        if not username:
            raise forms.ValidationError("닉네임을 입력해주세요.")
        
        # 앞뒤 공백 제거
        username = username.strip()
        
        # 길이 검증
        if len(username) < 2:
            raise forms.ValidationError("닉네임은 최소 2자 이상이어야 합니다.")
        
        if len(username) > 20:
            raise forms.ValidationError("닉네임은 최대 20자까지 입력 가능합니다.")
        
        # 🔥 공백 관련 검증
        if username.startswith(' ') or username.endswith(' '):
            raise forms.ValidationError("닉네임 앞뒤에 공백은 사용할 수 없습니다.")
        
        # 연속된 공백 금지
        if '  ' in username:  # 공백 2개 이상 연속
            raise forms.ValidationError("연속된 공백은 사용할 수 없습니다.")
        
        # 한글, 영문, 숫자, 단일 공백만 허용
        import re
        if not re.match(r'^[가-힣a-zA-Z0-9\s]+$', username):
            raise forms.ValidationError("닉네임은 한글, 영문, 숫자, 공백만 사용 가능합니다.")
        
        # 🔥 임시 username 패턴 금지
        if username.startswith(('temp_kakao_', 'temp_naver_', 'temp_google_')):
            raise forms.ValidationError("사용할 수 없는 닉네임 형식입니다.")
        
        # 🔥 기존 username 중복 검사 (현재 사용자 제외)
        existing_users = User.objects.filter(username=username).exclude(id=self.instance.id if self.instance else None)
        if existing_users.exists():
            raise forms.ValidationError("이미 사용 중인 닉네임입니다.")
        
        return username
    
    def save(self, commit=True):
        print("🔄 SocialSignupCompleteForm save 메서드 호출됨")
        user = super().save(commit=False)
        
        # 사용자명 변경
        old_username = user.username
        new_username = self.cleaned_data['username']
        
        print(f"🔄 사용자명 변경: {old_username} → {new_username}")
        
        user.username = new_username
        user.is_profile_completed = True  # 이것만 User 모델에 있음
        
        if commit:
            user.save()
            
            # 🔥 소셜 계정의 가입 완료 상태 업데이트 (별도 모델 사용)
            social_account = user.get_social_account()
            if social_account:
                social_account.signup_completed = True
                social_account.save()
            
            print(f"✅ 소셜 가입 완료 저장됨:")
            print(f"   - username: {user.username}")
            print(f"   - is_profile_completed: {user.is_profile_completed}")
            print(f"   - social_account.signup_completed: {social_account.signup_completed if social_account else 'N/A'}")
        
        return user

class MannerReviewForm(forms.ModelForm):
    class Meta:
        model = MannerReview
        fields = ['rating', 'description_match', 'response_speed', 'politeness', 'deal_again']
        widgets = {
            'rating': forms.RadioSelect(choices=MannerReview.RATING_CHOICES),
            # 'punctuality': forms.RadioSelect(choices=[
            #     ('빠름', '약속 시간보다 빨리 나옴'),
            #     ('정확', '정확하게 지킴'),
            #     ('늦음', '약속보다 늦음'),
            #     ('무통보', '연락 없이 늦거나 안 나옴')
            # ]),
            'description_match': forms.RadioSelect(choices=[
                ('동일', '설명과 동일함'),
                ('미세 차이', '미세한 차이가 있었음'),
                ('많이 다름', '많이 달랐음')
            ]),
            'response_speed': forms.RadioSelect(choices=[
                ('빠름', '빠르게 답장해줌'),
                ('보통', '평균적이었음'),
                ('느림', '느렸음'),
                ('무응답', '거의 답장이 없었음')
            ]),
            'politeness': forms.RadioSelect(choices=[
                ('친절', '친절하고 예의 바름'),
                ('보통', '보통'),
                ('불친절', '불친절하거나 무례했음')
            ]),
            'deal_again': forms.RadioSelect(choices=[('O', '예'), ('X', '아니오')]),
        }

class ProfileImageForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['profile_image']

class BankForm(forms.ModelForm):
    BANK_CHOICES = [
        ('004', 'KB국민은행'),
        ('088', '신한은행'),
        ('020', '우리은행'),
        ('003', 'IBK기업은행'),
        ('011', 'NH농협은행'),
        ('081', 'KEB하나은행'),
        ('071', '우체국예금보험'),
        ('023', 'SC제일은행'),
        ('090', '카카오뱅크'),
        ('089', '케이뱅크'),
        ('092', '토스뱅크'),
        ('031', '대구은행'),
        ('032', '부산은행'),
        ('034', '광주은행'),
        ('035', '제주은행'),
        ('037', '전북은행'),
        ('039', '경남은행'),
        ('045', '새마을금고'),
        ('048', '신협'),
        ('050', '상호저축은행'),
        ('064', '산림조합'),
        ('101', '신용보증기금'),
    ]
    
    bank_code = forms.ChoiceField(
        choices=BANK_CHOICES,
        widget=forms.Select(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'required': True
        }),
        label="은행 선택"
    )
    
    bank_number = forms.CharField(
        max_length=20,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '계좌번호를 입력하세요 (하이픈 제외)',
            'required': True
        }),
        label="계좌번호"
    )
    
    bank_holder = forms.CharField(
        max_length=50,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '예금주명을 입력하세요',
            'required': True
        }),
        label="예금주명"
    )
    
    class Meta:
        model = BankProfile
        fields = ['bank_code', 'bank_number', 'bank_holder']
    
    def clean_bank_number(self):
        bank_number = self.cleaned_data.get('bank_number')
        if not bank_number:
            raise forms.ValidationError("계좌번호를 입력해주세요.")
        
        # 숫자만 남기기 (하이픈, 공백 등 제거)
        cleaned_number = ''.join(filter(str.isdigit, bank_number))
        
        if len(cleaned_number) < 8:
            raise forms.ValidationError("올바른 계좌번호를 입력해주세요. (최소 8자리)")
        
        if len(cleaned_number) > 20:
            raise forms.ValidationError("계좌번호가 너무 깁니다. (최대 20자리)")
        
        return cleaned_number
    
    def clean_bank_holder(self):
        bank_holder = self.cleaned_data.get('bank_holder')
        if not bank_holder:
            raise forms.ValidationError("예금주명을 입력해주세요.")
        
        # 공백 제거
        bank_holder = bank_holder.strip()
        
        # 한글, 영문만 허용 (공백 포함)
        import re
        if not re.match(r'^[가-힣a-zA-Z\s]+$', bank_holder):
            raise forms.ValidationError("예금주명은 한글 또는 영문만 입력 가능합니다.")
        
        if len(bank_holder) < 2:
            raise forms.ValidationError("예금주명은 최소 2자 이상 입력해주세요.")
        
        if len(bank_holder) > 20:
            raise forms.ValidationError("예금주명이 너무 깁니다. (최대 20자)")
        
        return bank_holder
    
    def clean(self):
        cleaned_data = super().clean()
        bank_code = cleaned_data.get('bank_code')
        bank_number = cleaned_data.get('bank_number')
        bank_holder = cleaned_data.get('bank_holder')
        
        # 모든 필드가 입력되었는지 확인
        if not all([bank_code, bank_number, bank_holder]):
            raise forms.ValidationError("모든 필드를 입력해주세요.")
        
        return cleaned_data
    
    def save(self, user):
        """사용자와 연결해서 저장"""
        bank_profile = user.get_or_create_bank_profile()
        bank_profile.bank_code = self.cleaned_data['bank_code']
        bank_profile.bank_name = dict(self.BANK_CHOICES)[self.cleaned_data['bank_code']]
        bank_profile.bank_number = self.cleaned_data['bank_number']
        bank_profile.bank_holder = self.cleaned_data['bank_holder']
        bank_profile.save()
        return bank_profile

class AddressForm(forms.ModelForm):
    postal_code = forms.CharField(
        max_length=10,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '우편번호',
            'readonly': True  # 검색으로만 입력 가능
        }),
        label="우편번호"
    )
    
    road_address = forms.CharField(
        max_length=200,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '도로명주소',
            'readonly': True  # 검색으로만 입력 가능
        }),
        label="도로명주소"
    )
    
    detail_address = forms.CharField(
        max_length=200,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '상세주소를 입력하세요 (동, 호수 등)',
        }),
        label="상세주소"
    )

    phone_number = forms.CharField(
        max_length=15,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500',
            'placeholder': '010-1234-5678',
            'required': True
        }),
        label="연락처"
    )
    
    sido = forms.CharField(
        max_length=20,
        widget=forms.HiddenInput()
    )
    
    sigungu = forms.CharField(
        max_length=50,
        widget=forms.HiddenInput()
    )
    
    class Meta:
        model = AddressProfile
        fields = ['postal_code', 'road_address', 'detail_address', 'phone_number', 'sido', 'sigungu']
    
    def clean_postal_code(self):
        postal_code = self.cleaned_data.get('postal_code')
        if not postal_code:
            raise forms.ValidationError("우편번호를 입력해주세요.")
        return postal_code
    
    def clean_road_address(self):
        road_address = self.cleaned_data.get('road_address')
        if not road_address:
            raise forms.ValidationError("도로명주소를 입력해주세요.")
        return road_address
    
    def clean_detail_address(self):
        detail_address = self.cleaned_data.get('detail_address', '')
        if detail_address:
            detail_address = detail_address.strip()
            if len(detail_address) > 200:
                raise forms.ValidationError("상세주소는 최대 200자까지 입력 가능합니다.")
        return detail_address
    
    def clean_phone_number(self):
        phone = self.cleaned_data.get('phone_number')
        if not phone:
            raise forms.ValidationError("연락처를 입력해주세요.")
        
        # 숫자만 추출
        phone = re.sub(r'[^0-9]', '', phone)
        
        # 한국 휴대폰 번호 형식 검증 (010, 011, 016, 017, 018, 019)
        if not re.match(r'^01[0-9][0-9]{7,8}$', phone):
            raise forms.ValidationError('올바른 휴대폰 번호를 입력해주세요. (010-XXXX-XXXX)')
        
        # 하이픈 추가하여 저장
        if len(phone) == 10:
            return f"{phone[:3]}-{phone[3:6]}-{phone[6:]}"
        elif len(phone) == 11:
            return f"{phone[:3]}-{phone[3:7]}-{phone[7:]}"
        else:
            raise forms.ValidationError('올바른 휴대폰 번호를 입력해주세요.')

    def clean(self):
        cleaned_data = super().clean()
        postal_code = cleaned_data.get('postal_code')
        road_address = cleaned_data.get('road_address')
        phone_number = cleaned_data.get('phone_number')

        # 기본 주소 정보가 모두 입력되었는지 확인
        if not postal_code or not road_address:
            raise forms.ValidationError("주소 검색을 통해 기본 주소 정보를 입력해주세요.")
        
        if not phone_number:
            raise forms.ValidationError("연락처를 입력해주세요.")

        return cleaned_data
    
    def save(self, user):
        """사용자와 연결해서 저장"""
        address_profile = user.get_or_create_address_profile()
        address_profile.postal_code = self.cleaned_data['postal_code']
        address_profile.road_address = self.cleaned_data['road_address']
        address_profile.detail_address = self.cleaned_data.get('detail_address', '')
        address_profile.phone_number = self.cleaned_data['phone_number']
        address_profile.sido = self.cleaned_data['sido']
        address_profile.sigungu = self.cleaned_data['sigungu']
        address_profile.save()
        return address_profile

class PostReportForm(forms.ModelForm):
    """게시글 신고 폼 (덕담, 덕팜 공통)"""
    class Meta:
        model = PostReport
        fields = ['reason', 'additional_info']
        widgets = {
            'reason': forms.RadioSelect(attrs={
                'class': 'space-y-3'
            }),
            'additional_info': forms.Textarea(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500',
                'rows': 3,
                'placeholder': '추가로 설명할 내용이 있다면 작성해주세요 (선택사항)',
            }),
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['reason'].label = '신고 사유'
        self.fields['additional_info'].label = '추가 설명'
        self.fields['additional_info'].required = False

class BannerRequestForm(forms.ModelForm):
    """배너 신청 폼"""
    class Meta:
        model = BannerRequest
        fields = ['artist_name', 'banner_image']
        widgets = {
            'artist_name': forms.TextInput(attrs={
                'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500',
                'placeholder': '아티스트명을 입력하세요',
                'maxlength': 100
            }),
            'banner_image': forms.FileInput(attrs={
                'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500',
                'accept': 'image/*'
            })
        }
    
    def clean_artist_name(self):
        artist_name = self.cleaned_data.get('artist_name')
        if not artist_name:
            raise forms.ValidationError("아티스트명을 입력해주세요.")
        
        artist_name = artist_name.strip()
        if len(artist_name) < 2:
            raise forms.ValidationError("아티스트명은 최소 2자 이상이어야 합니다.")
        
        return artist_name
    
    def clean_banner_image(self):
        banner_image = self.cleaned_data.get('banner_image')
        if not banner_image:
            raise forms.ValidationError("배너 이미지를 업로드해주세요.")
        
        # 파일 크기 검증 (5MB 제한)
        if banner_image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("이미지 크기는 5MB 이하여야 합니다.")
        
        # 이미지 형식 검증
        if not banner_image.content_type.startswith('image/'):
            raise forms.ValidationError("이미지 파일만 업로드 가능합니다.")
        
        return banner_image