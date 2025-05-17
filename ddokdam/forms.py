from django import forms
from .models import DdokdamPost, DdokdamComment


class DdokdamPostForm(forms.ModelForm):
    class Meta:
        model = DdokdamPost
        fields = ('image', 'content',)


class CommunityPostForm(forms.ModelForm):
    idol = forms.CharField(required=False, widget=forms.Select(choices=[
        ('', '선택하세요 (선택사항)'),
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('twice', 'TWICE'),
        ('exo', 'EXO'),
        ('itzy', 'ITZY'),
        ('seventeen', 'SEVENTEEN'),
        ('nct', 'NCT'),
        ('ive', 'IVE'),
        ('aespa', 'aespa'),
        ('newjeans', 'NewJeans'),
    ]))

    class Meta:
        model = DdokdamPost
        fields = ('title', 'content', 'image', 'idol')
        widgets = {
            'content': forms.Textarea(attrs={
                'rows': '6',
                'placeholder': '아이돌에 대한 이야기, 질문 등 자유롭게 작성해주세요',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            }),
            'title': forms.TextInput(attrs={
                'placeholder': '제목을 입력하세요',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            }),
        }


class FoodPostForm(forms.ModelForm):
    location = forms.CharField(required=True, widget=forms.TextInput(attrs={
        'placeholder': '식당 또는 카페 이름을 입력하세요',
        'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
    }))

    doll = forms.CharField(required=False, widget=forms.Select(choices=[
        ('', '선택하세요'),
        ('bts', 'BTS 인형'),
        ('blackpink', 'BLACKPINK 인형'),
        ('twice', 'TWICE 인형'),
        ('exo', 'EXO 인형'),
        ('etc', '기타'),
    ]))

    class Meta:
        model = DdokdamPost
        fields = ('title', 'image', 'content', 'location', 'doll')
        widgets = {
            'content': forms.Textarea(attrs={
                'rows': '4',
                'placeholder': '음식과 분위기에 대해 설명해주세요',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            }),
            'title': forms.TextInput(attrs={
                'placeholder': '어떤 메뉴를 먹었나요?',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            }),
        }


class CafePostForm(forms.ModelForm):
    idol = forms.CharField(required=True, widget=forms.Select(choices=[
        ('', '선택하세요'),
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('twice', 'TWICE'),
        ('exo', 'EXO'),
        ('itzy', 'ITZY'),
        ('seventeen', 'SEVENTEEN'),
        ('nct', 'NCT'),
        ('ive', 'IVE'),
        ('aespa', 'aespa'),
        ('newjeans', 'NewJeans'),
    ]))

    cafe_name = forms.CharField(required=True, widget=forms.TextInput(attrs={
        'placeholder': '생일카페 이름을 입력하세요',
        'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
    }))

    cafe_location = forms.CharField(required=True, widget=forms.TextInput(attrs={
        'placeholder': '주소를 입력하세요',
        'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
    }))

    start_date = forms.DateField(required=False, widget=forms.DateInput(attrs={
        'type': 'date',
        'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
    }))

    end_date = forms.DateField(required=False, widget=forms.DateInput(attrs={
        'type': 'date',
        'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
    }))

    class Meta:
        model = DdokdamPost
        fields = ('title', 'content', 'image', 'idol', 'cafe_name', 'cafe_location', 'start_date', 'end_date')
        widgets = {
            'content': forms.Textarea(attrs={
                'rows': '6',
                'placeholder': '카페의 특징, 방문 꿀팁, 굿즈 정보 등을 자세히 공유해주세요',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            }),
            'title': forms.TextInput(attrs={
                'placeholder': '생일카페 제목을 입력하세요',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            }),
        }


class DdokdamCommentForm(forms.ModelForm):
    class Meta:
        model = DdokdamComment
        fields = ('content',)
        widgets = {
            'content': forms.Textarea(attrs={
                'rows': '2',
                'placeholder': '댓글을 입력하세요...',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
            })
        }
