from django import forms  # ✅ forms import
from .models import DdokdamPost, DdokdamComment  # ✅ 정확한 모델명 import

class DdokdamPostForm(forms.ModelForm):
    class Meta:
        model = DdokdamPost
        fields = ('title', 'content', 'category', 'image')

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
