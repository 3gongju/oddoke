from django import forms
from django.forms import modelformset_factory, HiddenInput
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment, SplitPrice

COMMON_INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400'
COMMON_RADIO_CLASS = 'space-y-2'
COMMON_DATE_CLASS = COMMON_INPUT_CLASS + ' date-input'

def custom_choice_field(choices, label, radio_class=COMMON_RADIO_CLASS):
    return forms.ChoiceField(
        choices=choices,
        widget=forms.RadioSelect(attrs={'class': radio_class}),
        label=label
    )

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
        'class': 'w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-400'
    }),
}

market_widgets = {
    'price': forms.NumberInput(attrs={
        'class': COMMON_INPUT_CLASS,
        'placeholder': '가격을 입력하세요',
    }),
    'location': forms.TextInput(attrs={
        'class': COMMON_INPUT_CLASS,
        'placeholder': '직거래 희망 장소를 입력하세요',
    }),
    'members': forms.CheckboxSelectMultiple(attrs={
        'class': 'space-y-2'
    }),
}


class FarmSellPostForm(forms.ModelForm):
    md = custom_choice_field(FarmSellPost.MD_CHOICES, label='종류')
    condition = custom_choice_field(FarmSellPost.CONDITION_CHOICES, label='상품 상태')
    shipping = custom_choice_field(FarmSellPost.SHIPPING_CHOICES, label='배송 방법')
    want_to = custom_choice_field(FarmSellPost.WANTTO_CHOICES, label='거래 방식')

    class Meta:
        model = FarmSellPost
        fields = ['title', 'content', 'price', 'md', 'condition', 'shipping', 'location', 'is_sold', 'want_to', 'artist', 'members']
        widgets = {
            **common_widgets,
            **market_widgets,
        }
        
class FarmRentalPostForm(forms.ModelForm):
    md = custom_choice_field(FarmSellPost.MD_CHOICES, label='종류')
    condition = custom_choice_field(FarmRentalPost.CONDITION_CHOICES, label='상품 상태')
    shipping = custom_choice_field(FarmRentalPost.SHIPPING_CHOICES, label='배송 방법')
    want_to = custom_choice_field(FarmRentalPost.WANTTO_CHOICES, label='거래 방식')

    class Meta:
        model = FarmRentalPost
        fields = ['title', 'content', 'price', 'md', 'condition', 'shipping', 'location', 'is_sold', 'want_to', 'start_date', 'end_date', 'artist', 'members']
        widgets = {
            **common_widgets,
            **market_widgets,
            'start_date': forms.DateInput(attrs={
            'type': 'date',
            'class': COMMON_DATE_CLASS
        }),
            'end_date': forms.DateInput(attrs={
            'type': 'date',
            'class': COMMON_DATE_CLASS
        }),
        }

class FarmSplitPostForm(forms.ModelForm):
    album = custom_choice_field(FarmSplitPost.ALBUM_CHOICES, label='앨범 포함 여부')
    failure = custom_choice_field(FarmSplitPost.FAILURE_CHOICES, label='무산 여부')

    class Meta:
        model = FarmSplitPost
        fields = ['title', 'content', 'album', 'shipping_fee', 'where', 'when', 'failure', 'artist']
        widgets = {
            **common_widgets,
            'shipping_fee': forms.NumberInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '재배송비를 입력하세요',
            }),
            'where': forms.TextInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '구매처를 입력하세요',
            }),
            'when': forms.DateInput(attrs={
            'type': 'date',
            'class': COMMON_DATE_CLASS
            }),
        }

class FarmCommentForm(forms.ModelForm):
    class Meta:
        model = FarmComment
        fields = ['content', 'parent']  # ✅ parent 추가
        widgets = {
            'parent': forms.HiddenInput()
        }

class SplitPriceForm(forms.ModelForm):
    class Meta:
        model = SplitPrice
        fields = ('member', 'price')
        widgets = {
            'member': forms.HiddenInput(),
            'price': forms.NumberInput(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded',
                'placeholder': '가격을 입력하세요',
            }),
        }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['price'].required = False
        self.fields['member'].disabled = False