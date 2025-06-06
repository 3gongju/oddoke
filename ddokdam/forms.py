from django import forms
from .models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment

COMMON_INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400'

common_widgets = {
    'title': forms.TextInput(attrs={
        'class': COMMON_INPUT_CLASS,
        'placeholder': '제목을 입력하세요',
    }),
    'content': forms.Textarea(attrs={
        'class': COMMON_INPUT_CLASS,
        'placeholder': '내용을 입력하세요',
        'rows': 6,
    }),
    'image': forms.ClearableFileInput(attrs={
        'class': 'block w-full text-sm text-gray-500 mt-1',
    }),
    'artist': forms.Select(attrs={
        'id': 'id_artist',
        'class': 'w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-400'
    }),
    'members': forms.CheckboxSelectMultiple(attrs={
        'class': 'space-y-2'
    }),
}

class DamCommunityPostForm(forms.ModelForm):
    class Meta:
        model = DamCommunityPost
        fields = ['title', 'content', 'artist', 'members']
        widgets = common_widgets

class DamMannerPostForm(forms.ModelForm):
    class Meta:
        model = DamMannerPost
        fields = ['title', 'content', 'item', 'location', 'artist', 'members']
        widgets = {
            **common_widgets,
            'location': forms.TextInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '장소를 입력하세요',
            }),
            'item': forms.TextInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '예절템을 입력하세요',
            }),
        }

class DamBdaycafePostForm(forms.ModelForm):
    class Meta:
        model = DamBdaycafePost
        fields = ['title', 'content', 'cafe_name', 'artist', 'members']
        widgets = {
            **common_widgets,
            'cafe_name': forms.TextInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '카페 이름을 입력하세요',
            }),
        }


# ✅ 댓글 작성 폼
class DamCommentForm(forms.ModelForm):
    class Meta:
        model = DamComment
        fields = ['content', 'parent']  # ✅ parent 추가
        widgets = {
            'parent': forms.HiddenInput()
        }
