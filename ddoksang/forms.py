# ddoksang/forms.py
from django import forms
from .models import BdayCafe
from artist.models import Artist, Member

class BdayCafeForm(forms.ModelForm):
    class Meta:
        model = BdayCafe
        fields = [
            'artist', 'member', 'cafe_type', 'cafe_name', 'address', 'place_name', 'road_address',
            'detailed_address', 'kakao_place_id', 'latitude', 'longitude', 'phone',
            'place_url', 'category_name', 'start_date', 'end_date', 'start_time',
            'end_time', 'special_benefits', 'event_description', 'hashtags',
            'main_image', 'poster_image', 'twitter_source'
        ]
        widgets = {
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'end_date': forms.DateInput(attrs={'type': 'date'}),
            'start_time': forms.TimeInput(attrs={'type': 'time'}),
            'end_time': forms.TimeInput(attrs={'type': 'time'}),
            'event_description': forms.Textarea(attrs={'rows': 4}),
            'special_benefits': forms.Textarea(attrs={'rows': 3}),
            'hashtags': forms.TextInput(attrs={'placeholder': '#태그1 #태그2'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 폼 필드 초기화
        self.fields['artist'].queryset = Artist.objects.all()
        self.fields['member'].queryset = Member.objects.all()
        self.fields['member'].required = False

# 커스텀 다중 파일 위젯
class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True

class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        single_file_clean = super().clean
        if isinstance(data, (list, tuple)):
            result = [single_file_clean(d, initial) for d in data]
        else:
            result = single_file_clean(data, initial)
        return result

# 이미지 업로드 폼 (다중 파일 지원)
class BdayCafeImageForm(forms.Form):
    images = MultipleFileField(
        required=False,
        widget=MultipleFileInput(attrs={
            'accept': 'image/*',
            'class': 'hidden',
        })
    )
    
    def clean_images(self):
        images = self.files.getlist('images')
        
        if len(images) > 5:  # 최대 5개 제한
            raise forms.ValidationError('최대 5개의 이미지만 업로드할 수 있습니다.')
        
        for image in images:
            if image.size > 5 * 1024 * 1024:  # 5MB 제한
                raise forms.ValidationError(f'{image.name}: 파일 크기가 5MB를 초과합니다.')
            
            if not image.content_type.startswith('image/'):
                raise forms.ValidationError(f'{image.name}: 이미지 파일만 업로드 가능합니다.')
        
        return images