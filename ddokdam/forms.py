from django import forms
from .models import DamCommunityPost, DamMannerPost, DamBdaycafePost

# 공통 아이돌 선택지
# IDOL_CHOICES = [
#     ('', '선택하세요'),
#     ('bts', 'BTS'),
#     ('blackpink', 'BLACKPINK'),
#     ('twice', 'TWICE'),
#     ('exo', 'EXO'),
#     ('itzy', 'ITZY'),
#     ('seventeen', 'SEVENTEEN'),
#     ('nct', 'NCT'),
#     ('ive', 'IVE'),
#     ('aespa', 'aespa'),
#     ('newjeans', 'NewJeans'),
# ]

# DOLL_CHOICES = [
#     ('', '선택하세요'),
#     ('bts', 'BTS 인형'),
#     ('blackpink', 'BLACKPINK 인형'),
#     ('twice', 'TWICE 인형'),
#     ('exo', 'EXO 인형'),
#     ('etc', '기타'),
# ]

# ✅ 커뮤니티용 폼
class DamCommunityPostForm(forms.ModelForm):
    # idol = forms.CharField(
    #     required=False,
    #     widget=forms.Select(choices=IDOL_CHOICES, attrs={'data-required': 'true'})
    # )

    class Meta:
        model = DamCommunityPost
        fields = ('title', 'content', 'image')
        # widgets = {
        #     'title': forms.TextInput(attrs={
        #         'placeholder': '제목을 입력하세요',
        #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
        #         'data-required': 'true',
        #     }),
        #     'content': forms.Textarea(attrs={
        #         'rows': '6',
        #         'placeholder': '아이돌에 대한 이야기, 질문 등 자유롭게 작성해주세요',
        #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
        #         'data-required': 'true',
        #     }),
        #     'image': forms.ClearableFileInput(attrs={
        #         'data-required': 'true',
        #     }),
        # }

# ✅ 예절샷 폼
class DamMannerPostForm(forms.ModelForm):
    # location = forms.CharField(
    #     required=False,
    #     widget=forms.TextInput(attrs={
    #         'placeholder': '식당 또는 카페 이름을 입력하세요',
    #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
    #         'data-required': 'true',
    #     })
    # )

    # item = forms.CharField(
    #     required=False,
    #     widget=forms.Select(choices=DOLL_CHOICES, attrs={'data-required': 'true'})
    # )

    class Meta:
        model = DamMannerPost
        fields = ('title', 'image', 'content', 'location', 'item')
        # widgets = {
        #     'title': forms.TextInput(attrs={
        #         'placeholder': '어떤 메뉴를 먹었나요?',
        #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
        #         'data-required': 'true',
        #     }),
        #     'content': forms.Textarea(attrs={
        #         'rows': '4',
        #         'placeholder': '음식과 분위기에 대해 설명해주세요',
        #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
        #         'data-required': 'true',
        #     }),
        #     'image': forms.ClearableFileInput(attrs={
        #         'data-required': 'true',
        #     }),
        # }

# ✅ 생일카페 폼
class CafePostForm(forms.ModelForm):
    # idol = forms.CharField(
    #     required=False,
    #     widget=forms.Select(choices=IDOL_CHOICES, attrs={'data-required': 'true'})
    # )

    # cafe_name = forms.CharField(
    #     required=False,
    #     widget=forms.TextInput(attrs={
    #         'placeholder': '생일카페 이름을 입력하세요',
    #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
    #         'data-required': 'true',
    #     })
    # )

    # cafe_location = forms.CharField(
    #     required=False,
    #     widget=forms.TextInput(attrs={
    #         'placeholder': '주소를 입력하세요',
    #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
    #         'data-required': 'true',
    #     })
    # )

    # start_date = forms.DateField(
    #     required=False,
    #     widget=forms.DateInput(attrs={
    #         'type': 'date',
    #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
    #         'data-required': 'true',
    #     })
    # )

    # end_date = forms.DateField(
    #     required=False,
    #     widget=forms.DateInput(attrs={
    #         'type': 'date',
    #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
    #         'data-required': 'true',
    #     })
    # )

    class Meta:
        model = DdokdamPost
        fields = ('title', 'content', 'image', 'cafe_name', 'cafe_location', 'start_date', 'end_date')
        # widgets = {
        #     'title': forms.TextInput(attrs={
        #         'placeholder': '생일카페 리뷰 제목을 입력하세요',
        #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
        #         'data-required': 'true',
        #     }),
        #     'content': forms.Textarea(attrs={
        #         'rows': '6',
        #         'placeholder': '카페의 특징, 방문 꿀팁, 굿즈 정보 등을 공유해주세요',
        #         'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
        #         'data-required': 'true',
        #     }),
        #     'image': forms.ClearableFileInput(attrs={
        #         'data-required': 'true',
        #     }),
        # }

# ✅ 댓글 작성 폼
class DdokdamCommentForm(forms.ModelForm):
    class Meta:
        model = DdokdamComment
        fields = ['content', 'parent']  # ✅ parent 추가
        widgets = {
            'parent': forms.HiddenInput(),
            'content': forms.Textarea(attrs={
                'rows': '2',
                'placeholder': '댓글을 입력하세요...',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
            })
        }
