# ddokdam/forms.py
from django import forms
from .models import DdokdamPost, DdokdamComment

class DdokdamPostForm(forms.ModelForm):
    class Meta:
        model = DdokdamPost
        fields = ('title', 'content', 'category', 'image')
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
                'placeholder': '제목을 입력하세요'
            }),
            'content': forms.Textarea(attrs={
                'rows': 5,
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
                'placeholder': '내용을 입력하세요'
            }),
            'category': forms.Select(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            }),
            'image': forms.ClearableFileInput(attrs={
                'class': 'w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-purple-500 file:text-white hover:file:bg-purple-600'
            }),
        }

    # ✅ 기본값 지정 및 required 해제 (폼 오류 방지)
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['category'].initial = 'community'
        self.fields['category'].required = False  # ← 핵심 포인트


class DdokdamCommentForm(forms.ModelForm):
    class Meta:
        model = DdokdamComment
        fields = ('content',)
        widgets = {
            'content': forms.Textarea(attrs={
                'rows': 2,
                'placeholder': '댓글을 입력하세요...',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            })
        }
