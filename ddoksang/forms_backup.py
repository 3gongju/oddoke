from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import BdayCafe, BdayCafeImage, CafeFavorite

class BdayCafeForm(forms.ModelForm):
    """생일카페 등록/수정 폼"""

    class Meta:
        model = BdayCafe
        fields = [
            'artist', 'member', 'cafe_type',
            'cafe_name', 'place_name', 'address', 'road_address', 'detailed_address',
            'latitude', 'longitude',
            'start_date', 'end_date', 'start_time', 'end_time',
            'special_benefits', 'event_description', 'hashtags',
            'x_source'
        ]
        widgets = {
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'end_date': forms.DateInput(attrs={'type': 'date'}),
            'start_time': forms.TimeInput(attrs={'type': 'time'}),
            'end_time': forms.TimeInput(attrs={'type': 'time'}),
            'address': forms.Textarea(attrs={'rows': 3}),
            'road_address': forms.Textarea(attrs={'rows': 3}),
            'special_benefits': forms.Textarea(attrs={'rows': 4}),
            'event_description': forms.Textarea(attrs={'rows': 4}),
            'hashtags': forms.TextInput(attrs={'placeholder': '#생일카페 #아이돌이름'}),
            'latitude': forms.HiddenInput(),
            'longitude': forms.HiddenInput(),
        }

    def clean_x_source(self):
        """사용자가 @아이디 형태로 입력한 경우 자동 URL로 변환"""
        x_source = self.cleaned_data.get('x_source', '').strip()
        if x_source and not x_source.startswith('http'):
            username = x_source.lstrip('@')
            return f"https://x.com/{username}"
        return x_source

class BdayCafeImageForm(forms.ModelForm):
    """생일카페 이미지 업로드 폼"""
    
    class Meta:
        model = BdayCafeImage
        fields = ['image', 'image_type', 'caption', 'order', 'is_main']
        widgets = {
            'caption': forms.TextInput(attrs={'placeholder': '이미지 설명'}),
            'order': forms.NumberInput(attrs={'min': 0}),
        }

class CafeFavoriteForm(forms.ModelForm):
    """카페 즐겨찾기 폼"""
    
    class Meta:
        model = CafeFavorite
        fields = ['cafe']




# 다중 이미지 업로드를 위한 FormSet
BdayCafeImageFormSet = forms.modelformset_factory(
    BdayCafeImage,
    form=BdayCafeImageForm,
    extra=3,  # 기본 3개 이미지 업로드 필드
    can_delete=True,
    max_num=10  # 최대 10개 이미지
)