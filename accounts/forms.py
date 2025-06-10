from django import forms
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import User, MannerReview

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True)
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
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError("이미 사용 중인 사용자명입니다.")
        return username

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")

        if password1 and password2 and password1 != password2:
            self.add_error('password2', "비밀번호가 일치하지 않습니다.")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_active = False  # 이메일 인증 전까지 비활성화
        if commit:
            user.save()
        return user

# 이메일 로그인폼
class EmailAuthenticationForm(forms.Form):
    email = forms.EmailField(
        label="이메일",
        widget=forms.EmailInput(attrs={
            'class': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
            'placeholder': '이메일을 입력하세요'
        })
    )
    password = forms.CharField(
        label="비밀번호",
        widget=forms.PasswordInput(attrs={
            'class': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
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

# 추가 로그인폼
# class CustomAuthenticationForm(AuthenticationForm):
#     def __init__(self, *args, **kwargs):
#         super().__init__(*args, **kwargs)
#         self.fields['username'].widget.attrs.update({
#             'class': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
#             'placeholder': '아이디 또는 이메일을 입력하세요'
#         })
#         self.fields['password'].widget.attrs.update({
#             'class': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
#             'placeholder': '비밀번호를 입력하세요'
#         })

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

class BankAccountForm(forms.ModelForm):
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
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'required': True
        }),
        label="은행 선택"
    )
    
    account_number = forms.CharField(
        max_length=20,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'placeholder': '계좌번호를 입력하세요 (하이픈 제외)',
            'required': True
        }),
        label="계좌번호"
    )
    
    account_holder = forms.CharField(
        max_length=50,
        widget=forms.TextInput(attrs={
            'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'placeholder': '예금주명을 입력하세요',
            'required': True
        }),
        label="예금주명"
    )
    
    class Meta:
        model = User
        fields = ['bank_code', 'account_number', 'account_holder']
    
    def clean_account_number(self):
        account_number = self.cleaned_data.get('account_number')
        if not account_number:
            raise forms.ValidationError("계좌번호를 입력해주세요.")
        
        # 숫자만 남기기 (하이픈, 공백 등 제거)
        cleaned_number = ''.join(filter(str.isdigit, account_number))
        
        if len(cleaned_number) < 8:
            raise forms.ValidationError("올바른 계좌번호를 입력해주세요. (최소 8자리)")
        
        if len(cleaned_number) > 20:
            raise forms.ValidationError("계좌번호가 너무 깁니다. (최대 20자리)")
        
        return cleaned_number
    
    def clean_account_holder(self):
        account_holder = self.cleaned_data.get('account_holder')
        if not account_holder:
            raise forms.ValidationError("예금주명을 입력해주세요.")
        
        # 공백 제거
        account_holder = account_holder.strip()
        
        # 한글, 영문만 허용 (공백 포함)
        import re
        if not re.match(r'^[가-힣a-zA-Z\s]+$', account_holder):
            raise forms.ValidationError("예금주명은 한글 또는 영문만 입력 가능합니다.")
        
        if len(account_holder) < 2:
            raise forms.ValidationError("예금주명은 최소 2자 이상 입력해주세요.")
        
        if len(account_holder) > 20:
            raise forms.ValidationError("예금주명이 너무 깁니다. (최대 20자)")
        
        return account_holder
    
    def clean(self):
        cleaned_data = super().clean()
        bank_code = cleaned_data.get('bank_code')
        account_number = cleaned_data.get('account_number')
        account_holder = cleaned_data.get('account_holder')
        
        # 모든 필드가 입력되었는지 확인
        if not all([bank_code, account_number, account_holder]):
            raise forms.ValidationError("모든 필드를 입력해주세요.")
        
        return cleaned_data