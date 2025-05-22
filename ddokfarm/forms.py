from django import forms
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment

class FarmSellPostForm(forms.ModelForm):
    class Meta:
        model = FarmSellPost
        fields = ['title', 'content', 'image', 'price', 'condition', 'shipping', 'location', 'is_sold', 'want_to']

class FarmRentalPostForm(forms.ModelForm):
    class Meta:
        model = FarmRentalPost
        fields = ['title', 'content', 'image', 'price', 'condition', 'shipping', 'location', 'is_sold', 'want_to', 'start_date', 'end_date']

class FarmSplitPostForm(forms.ModelForm):
    class Meta:
        model = FarmSplitPost
        fields = ['title', 'content', 'image', 'album', 'opened', 'shipping_fee', 'where', 'when', 'failure']

class FarmCommentForm(forms.ModelForm):
    class Meta:
        model = FarmComment
        fields = ['content']


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
