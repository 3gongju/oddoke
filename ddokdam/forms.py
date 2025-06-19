from django import forms
from .models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment, DamPostReport

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
    # 숨겨진 필드로 덕생 카페 ID 저장 (새로운 필드)
    linked_ddoksang_cafe_id = forms.IntegerField(
        required=False,
        widget=forms.HiddenInput()
    )
    
    class Meta:
        model = DamBdaycafePost
        fields = ['title', 'content', 'cafe_name', 'artist', 'members']  # 기존 필드들 유지
        widgets = {
            **common_widgets,  # 기존 공통 위젯 사용
            'cafe_name': forms.TextInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '카페 이름을 입력하세요 (덕생 카페 자동완성 지원)',
                'autocomplete': 'off',  # 브라우저 자동완성 비활성화
                'data-ddoksang-autocomplete': 'true',  # 자동완성 활성화 플래그
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 기존 인스턴스가 있고 덕생 카페가 연결되어 있으면 초기값 설정
        if self.instance and self.instance.pk and self.instance.linked_ddoksang_cafe_id:
            self.fields['linked_ddoksang_cafe_id'].initial = self.instance.linked_ddoksang_cafe_id
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        
        # 연결된 덕생 카페 ID 설정
        linked_cafe_id = self.cleaned_data.get('linked_ddoksang_cafe_id')
        if linked_cafe_id:
            instance.linked_ddoksang_cafe_id = linked_cafe_id
        
        if commit:
            instance.save()
            
        return instance

# ✅ 댓글 작성 폼
class DamCommentForm(forms.ModelForm):
    class Meta:
        model = DamComment
        fields = ['content', 'parent']  # ✅ parent 추가
        widgets = {
            'parent': forms.HiddenInput()
        }


class DamPostReportForm(forms.ModelForm):
    class Meta:
        model = DamPostReport
        fields = ['reason', 'additional_info']
        widgets = {
            'reason': forms.RadioSelect(attrs={
                'class': 'space-y-3'
            }),
            'additional_info': forms.Textarea(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500',
                'rows': 3,
                'placeholder': '추가로 설명할 내용이 있다면 작성해주세요 (선택사항)',
            }),
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['reason'].label = '신고 사유'
        self.fields['additional_info'].label = '추가 설명'
        self.fields['additional_info'].required = False