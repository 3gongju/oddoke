from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import User, MannerReview
from django import forms

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

# 추가 로그인폼폼
class CustomAuthenticationForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({
            'class': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
            'placeholder': '아이디 또는 이메일을 입력하세요'
        })
        self.fields['password'].widget.attrs.update({
            'class': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
            'placeholder': '비밀번호를 입력하세요'
        })

class MannerReviewForm(forms.ModelForm):
    class Meta:
        model = MannerReview
        fields = ['rating', 'punctuality', 'description_match', 'response_speed', 'politeness', 'deal_again']
        widgets = {
            'rating': forms.RadioSelect(choices=MannerReview.RATING_CHOICES),
            'punctuality': forms.RadioSelect(choices=[
                ('빠름', '약속 시간보다 빨리 나옴'),
                ('정확', '정확하게 지킴'),
                ('늦음', '약속보다 늦음'),
                ('무통보', '연락 없이 늦거나 안 나옴')
            ]),
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