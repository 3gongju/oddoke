from django import forms
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment

common_widgets = {
    'title': forms.TextInput(attrs={
        'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400',
        'placeholder': '제목을 입력하세요',
    }),
    'content': forms.Textarea(attrs={
        'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400',
        'placeholder': '내용을 입력하세요',
        'rows': 6,
    }),
    'image': forms.ClearableFileInput(attrs={
        'class': 'block w-full text-sm text-gray-500 mt-1',
    }),
}

market_widgets = {
    'price': forms.NumberInput(attrs={
        'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400',
        'placeholder': '가격을 입력하세요',
    }),
    'location': forms.TextInput(attrs={
        'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400',
        'placeholder': '거래 장소를 입력하세요',
    }),
    'condition': forms.RadioSelect(attrs={'class': 'space-y-2'}),
    'shipping': forms.RadioSelect(attrs={'class': 'space-y-2'}),
    'want_to': forms.RadioSelect(attrs={'class': 'space-y-2'}),
}

class FarmSellPostForm(forms.ModelForm):
    class Meta:
        model = FarmSellPost
        fields = ['title', 'content', 'image', 'price', 'condition', 'shipping', 'location', 'is_sold', 'want_to']
        widgets = {
            **common_widgets,
            **market_widgets,
        }
        
class FarmRentalPostForm(forms.ModelForm):
    class Meta:
        model = FarmRentalPost
        fields = ['title', 'content', 'image', 'price', 'condition', 'shipping', 'location', 'is_sold', 'want_to', 'start_date', 'end_date']
        widgets = {
            **common_widgets,
            **market_widgets,
            'start_date': forms.DateInput(attrs={
                'type': 'date',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400'
            }),
            'end_date': forms.DateInput(attrs={
                'type': 'date',
                'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400'
            }),
        }

class FarmSplitPostForm(forms.ModelForm):
    class Meta:
        model = FarmSplitPost
        fields = ['title', 'content', 'image', 'album', 'opened', 'shipping_fee', 'where', 'when', 'failure']
        widgets = {
            **common_widgets,
            'shipping_fee': forms.NumberInput(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400',
                'placeholder': '배송비를 입력하세요',
            }),
            'where': forms.TextInput(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400',
                'placeholder': '분배 장소를 입력하세요',
            }),
            'when': forms.TextInput(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400',
                'placeholder': '분배 일시를 입력하세요',
            }),
            'album': forms.RadioSelect(attrs={'class': 'space-y-2'}),
            'opened': forms.RadioSelect(attrs={'class': 'space-y-2'}),
            'failure': forms.RadioSelect(attrs={'class': 'space-y-2'}),
        }

class FarmCommentForm(forms.ModelForm):
    class Meta:
        model = FarmComment
        fields = ['content', 'parent']  # ✅ parent 추가
        widgets = {
            'parent': forms.HiddenInput()
        }


# class DdokfarmPostForm(forms.ModelForm):
#     class Meta:
#         model = DdokfarmPost
#         fields = ('image', 'title', 'price', 'category', 'condition', 'exchange', 
#                   'direct_deal', 'preferred_location', 'shipping', 'content')
        
#         # 라디오 버튼으로 표시할 필드 위젯 설정
#         widgets = {
#             'condition': forms.RadioSelect(),
#             'exchange': forms.RadioSelect(),
#             'direct_deal': forms.RadioSelect(),
#             'shipping': forms.RadioSelect(),
#             'content': forms.Textarea(attrs={
#                 'rows': '5',
#                 'placeholder': '상품에 대한 자세한 설명을 입력하세요',
#                 'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
#             }),
#             'preferred_location': forms.TextInput(attrs={
#                 'placeholder': '직거래 희망 장소를 입력하세요',
#                 'class': 'w-full px-3 py-2 border border-gray-300 rounded-md'
#             }),
#         }

# class DdokfarmCommentForm(forms.ModelForm):
#     class Meta:
#         model = DdokfarmComment
#         fields = ['content', 'parent']
#         widgets = {
#             'content': forms.Textarea(attrs={
#                 'rows': '2',
#                 'placeholder': '댓글을 입력하세요...',
#                 'class': 'w-full px-3 py-2 border border-gray-300 rounded-md',
#                 'parent': forms.HiddenInput()
#             })
#         }
