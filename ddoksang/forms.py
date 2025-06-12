from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import BdayCafe, BdayCafeImage, CafeFavorite, TourPlan, TourStop

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

class TourPlanForm(forms.ModelForm):
    """투어 계획 생성/수정 폼"""
    
    class Meta:
        model = TourPlan
        fields = ['title', 'is_public']
        widgets = {
            'title': forms.TextInput(attrs={
                'placeholder': '나만의 카페 투어 계획',
                'maxlength': 100
            }),
        }

class TourStopForm(forms.ModelForm):
    """투어 정거장 폼"""
    
    class Meta:
        model = TourStop
        fields = ['cafe', 'order', 'stay_duration', 'notes']
        widgets = {
            'stay_duration': forms.NumberInput(attrs={
                'min': 10, 
                'max': 180, 
                'step': 5,
                'placeholder': '30'
            }),
            'notes': forms.Textarea(attrs={
                'rows': 2, 
                'placeholder': '이 카페에서 하고 싶은 것들...'
            }),
        }

# 다중 이미지 업로드를 위한 FormSet
BdayCafeImageFormSet = forms.modelformset_factory(
    BdayCafeImage,
    form=BdayCafeImageForm,
    extra=3,  # 기본 3개 이미지 업로드 필드
    can_delete=True,
    max_num=10  # 최대 10개 이미지
)