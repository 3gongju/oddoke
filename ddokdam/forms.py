from django import forms
from .models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment

class DamCommunityPostForm(forms.ModelForm):
    class Meta:
        model = DamCommunityPost
        fields = ['title', 'content', 'image']

class DamMannerPostForm(forms.ModelForm):
    class Meta:
        model = DamMannerPost
        fields = ['title', 'content', 'image', 'location', 'item']

class DamBdaycafePostForm(forms.ModelForm):
    class Meta:
        model = DamBdaycafePost
        fields = ['title', 'content', 'image', 'cafe_name']


# ✅ 댓글 작성 폼
class DamCommentForm(forms.ModelForm):
    class Meta:
        model = DamComment
        fields = ['content', 'parent']  # ✅ parent 추가
        widgets = {
            'parent': forms.HiddenInput(),
            'content': forms.Textarea(attrs={
                'rows': '2',
                'placeholder': '댓글을 입력하세요...',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
            })
        }
