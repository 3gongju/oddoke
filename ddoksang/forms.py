from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import BdayCafe, CafeFavorite

class BdayCafeForm(forms.ModelForm):
    """생일카페 등록/수정 폼 (이미지 갤러리 포함)"""

    class Meta:
        model = BdayCafe
        fields = [
            'artist', 'member', 'cafe_type',
            'cafe_name', 'place_name', 'address', 'road_address',
            'latitude', 'longitude',
            'start_date', 'end_date',
            'special_benefits', 'event_description',
            'x_source'
            # ✅ image_gallery는 JavaScript로 직접 처리 (JSONField)
        ]
        widgets = {
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'end_date': forms.DateInput(attrs={'type': 'date'}),
            'address': forms.Textarea(attrs={'rows': 3}),
            'road_address': forms.Textarea(attrs={'rows': 3}),
            'special_benefits': forms.Textarea(attrs={'rows': 4}),
            'event_description': forms.Textarea(attrs={'rows': 4}),
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

 

class CafeFavoriteForm(forms.ModelForm):
    """카페 즐겨찾기 폼"""
    
    class Meta:
        model = CafeFavorite
        fields = ['cafe']



