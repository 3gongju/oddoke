from django import forms
from django.forms import modelformset_factory, HiddenInput
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment, SplitPrice, ItemPrice, SHIPPING_METHOD_CHOICES

COMMON_INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-400'
COMMON_RADIO_CLASS = 'space-y-2'
COMMON_DATE_CLASS = COMMON_INPUT_CLASS + ' date-input'

def custom_choice_field(choices, label, radio_class=COMMON_RADIO_CLASS):
    return forms.ChoiceField(
        choices=choices,
        widget=forms.RadioSelect(attrs={'class': radio_class}),
        label=label
    )

# 배송 방법 선택 필드 (체크박스)
def shipping_methods_field():
    return forms.MultipleChoiceField(
        choices=SHIPPING_METHOD_CHOICES,
        widget=forms.CheckboxSelectMultiple(attrs={'class': 'space-y-2'}),
        required=False,
        label='배송 방법 (복수 선택 가능)'
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
        'class': 'w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-pink-400'
    }),
    # 배송비 위젯 추가
    'shipping_fee': forms.NumberInput(attrs={
        'class': COMMON_INPUT_CLASS,
        'placeholder': '배송비를 입력하세요',
        'min': 0,
    }),
}

market_widgets = {
    # price 위젯 제거됨
    'location': forms.TextInput(attrs={
        'class': COMMON_INPUT_CLASS,
        'placeholder': '직거래 희망 장소를 입력하세요',
    }),
    'members': forms.CheckboxSelectMultiple(attrs={
        'class': 'space-y-2'
    }),
}

# 개별 아이템 가격 폼
class ItemPriceForm(forms.ModelForm):
    class Meta:
        model = ItemPrice
        fields = ['item_name', 'price']
        widgets = {
            'item_name': forms.TextInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '물건명 (선택사항)',
                'maxlength': 20,
            }),
            'price': forms.NumberInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '가격을 입력하세요',
                'min': 0,
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # item_name은 선택사항
        self.fields['item_name'].required = False
        self.fields['price'].required = True

class FarmSellPostForm(forms.ModelForm):
    md = custom_choice_field(FarmSellPost.MD_CHOICES, label='종류')
    condition = custom_choice_field(FarmSellPost.CONDITION_CHOICES, label='상품 상태')
    shipping = custom_choice_field(FarmSellPost.SHIPPING_CHOICES, label='배송 방법')
    want_to = custom_choice_field(FarmSellPost.WANTTO_CHOICES, label='거래 방식')
    
    # 배송 방법 선택 필드 추가
    shipping_methods = shipping_methods_field()

    class Meta:
        model = FarmSellPost
        fields = [
            'title', 'content', 'md', 'condition', 'shipping', 
            'location', 'is_sold', 'want_to', 'artist', 'members',
            'shipping_methods', 'shipping_fee'  # 배송 관련 필드 추가
        ]
        widgets = {
            **common_widgets,
            **market_widgets,
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 기존 데이터가 있을 때 shipping_methods 초기화
        if self.instance and self.instance.pk:
            self.fields['shipping_methods'].initial = self.instance.get_shipping_methods_list()
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # shipping_methods를 콤마로 구분된 문자열로 저장
        shipping_methods = self.cleaned_data.get('shipping_methods', [])
        instance.shipping_methods = ','.join(shipping_methods)
        if commit:
            instance.save()
        return instance

class FarmRentalPostForm(forms.ModelForm):
    condition = custom_choice_field(FarmRentalPost.CONDITION_CHOICES, label='상품 상태')
    shipping = custom_choice_field(FarmRentalPost.SHIPPING_CHOICES, label='배송 방법')
    want_to = custom_choice_field(FarmRentalPost.WANTTO_CHOICES, label='거래 방식')
    
    # 배송 방법 선택 필드 추가
    shipping_methods = shipping_methods_field()

    class Meta:
        model = FarmRentalPost
        fields = [
            'title', 'content', 'condition', 'shipping', 
            'location', 'is_sold', 'want_to', 'start_date', 'end_date', 
            'artist', 'members', 'shipping_methods', 'shipping_fee'  # 배송 관련 필드 추가
        ]
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
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 기존 데이터가 있을 때 shipping_methods 초기화
        if self.instance and self.instance.pk:
            self.fields['shipping_methods'].initial = self.instance.get_shipping_methods_list()
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # shipping_methods를 콤마로 구분된 문자열로 저장
        shipping_methods = self.cleaned_data.get('shipping_methods', [])
        instance.shipping_methods = ','.join(shipping_methods)
        if commit:
            instance.save()
        return instance

class FarmSplitPostForm(forms.ModelForm):
    album = custom_choice_field(FarmSplitPost.ALBUM_CHOICES, label='앨범 포함 여부')
    failure = custom_choice_field(FarmSplitPost.FAILURE_CHOICES, label='무산 여부')
    push = custom_choice_field(FarmSplitPost.PUSH_CHOICES, label='밀어내기')
    
    # 배송 방법 선택 필드 추가
    shipping_methods = shipping_methods_field()

    class Meta:
        model = FarmSplitPost
        fields = [
            'title', 'content', 'album', 'where', 'when', 'failure', 
            'artist', 'push', 'shipping_methods', 'shipping_fee'  # shipping_fee는 이제 상위 클래스에서
        ]
        widgets = {
            **common_widgets,
            'where': forms.TextInput(attrs={
                'class': COMMON_INPUT_CLASS,
                'placeholder': '구매처를 입력하세요',
            }),
            'when': forms.DateInput(attrs={
                'type': 'date',
                'class': COMMON_DATE_CLASS
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 기존 데이터가 있을 때 shipping_methods 초기화
        if self.instance and self.instance.pk:
            self.fields['shipping_methods'].initial = self.instance.get_shipping_methods_list()
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # shipping_methods를 콤마로 구분된 문자열로 저장
        shipping_methods = self.cleaned_data.get('shipping_methods', [])
        instance.shipping_methods = ','.join(shipping_methods)
        if commit:
            instance.save()
        return instance

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