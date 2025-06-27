from django import forms
from django.forms import modelformset_factory, HiddenInput
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment, SplitPrice, ItemPrice, ExchangeItem, SHIPPING_METHOD_CHOICES

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
    """개별 아이템 가격 입력 폼 (ModelForm 기반) - 수정된 버전"""
    
    class Meta:
        model = ItemPrice
        fields = ['item_name', 'price', 'is_price_undetermined']
        widgets = {
            'item_name': forms.TextInput(attrs={
                'class': 'item-name-input w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-400',
                'placeholder': '물건명 (선택사항)',
                'maxlength': 20,
            }),
            'price': forms.NumberInput(attrs={
                'class': 'item-price-input w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-400',
                'placeholder': '가격',
                'min': 0,
            }),
            'is_price_undetermined': forms.CheckboxInput(attrs={
                'class': 'item-price-undetermined-checkbox w-3 h-3 text-green-600 border-gray-300 rounded focus:ring-green-500',
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['item_name'].required = False
        self.fields['price'].required = False  # JavaScript에서 조건부로 검증
        self.fields['is_price_undetermined'].required = False
        
        # 필드 라벨 제거 (템플릿에서 직접 처리)
        for field in self.fields.values():
            field.label = ''
    
    def clean(self):
        """🔧 수정된 clean 메서드"""
        cleaned_data = super().clean()
        price = cleaned_data.get('price')
        is_undetermined = cleaned_data.get('is_price_undetermined', False)
        
        # 🔧 빈 폼 체크 (모든 필드가 비어있으면 무시)
        item_name = cleaned_data.get('item_name', '').strip()
        if not item_name and not price and not is_undetermined:
            # 완전히 빈 폼은 그냥 통과 (FormSet에서 처리)
            return cleaned_data
        
        # 가격 미정이 아닌데 가격이 없거나 0이면 에러
        if not is_undetermined:
            if price is None or price == '' or price == 0:
                raise forms.ValidationError("가격을 입력하거나 '가격 미정'을 선택해주세요.")
            if price < 0:
                raise forms.ValidationError("가격은 0 이상이어야 합니다.")
        else:
            # 가격 미정이면 price를 0으로 설정
            cleaned_data['price'] = 0
            
        return cleaned_data

# ItemPrice ModelFormSet 생성 - 수정된 버전
ItemPriceFormSet = modelformset_factory(
    ItemPrice,
    form=ItemPriceForm,
    extra=0,  # 기본적으로 빈 폼 없음
    can_delete=True,
    min_num=0,  # 🔧 최소 개수를 0으로 변경 (빈 폼 허용)
    validate_min=False,  # 🔧 최소 검증 비활성화
    max_num=20,  # 최대 20개로 제한
)

class FarmSellPostForm(forms.ModelForm):
    md = custom_choice_field(FarmSellPost.MD_CHOICES, label='종류')
    condition = custom_choice_field(FarmSellPost.CONDITION_CHOICES, label='상품 상태')
    shipping = custom_choice_field(FarmSellPost.SHIPPING_CHOICES, label='배송 방법')
    want_to = custom_choice_field(FarmSellPost.WANTTO_CHOICES, label='거래 방식')
    
    # 배송 방법 선택 필드 추가
    shipping_methods = shipping_methods_field()

    # ✅ 교환 정보 필드 추가
    give_description = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': COMMON_INPUT_CLASS,
            'placeholder': '내가 주는 것을 입력하세요',
        }),
        required=False,
        label='내가 주는 것',
    )
    
    want_description = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': COMMON_INPUT_CLASS,
            'placeholder': '내가 받고 싶은 것을 입력하세요',
        }),
        required=False,
        label='내가 받고 싶은 것',
    )

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
        # ItemPrice 초기 데이터 처리
        self.item_prices_initial = kwargs.pop('item_prices_initial', [])
        super().__init__(*args, **kwargs)

        # 기존 데이터가 있을 때 shipping_methods 초기화
        if self.instance and self.instance.pk:
            self.fields['shipping_methods'].initial = self.instance.get_shipping_methods_list()

            # ✅ 교환 정보 초기화 (수정 모드)
            if hasattr(self.instance, 'exchange_info') and self.instance.exchange_info:
                self.fields['give_description'].initial = self.instance.exchange_info.give_description
                self.fields['want_description'].initial = self.instance.exchange_info.want_description
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # shipping_methods를 콤마로 구분된 문자열로 저장
        shipping_methods = self.cleaned_data.get('shipping_methods', [])
        instance.shipping_methods = ','.join(shipping_methods)
        if commit:
            instance.save()
        return instance

    def get_item_price_formset(self, data=None):
        """ItemPrice FormSet 반환"""
        if data:
            return ItemPriceFormSet(data, prefix='item_prices')
        else:
            # 수정 모드에서 기존 데이터로 초기화
            initial_data = self.item_prices_initial or []
            return ItemPriceFormSet(initial=initial_data, prefix='item_prices')

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
        # ItemPrice 초기 데이터 처리
        self.item_prices_initial = kwargs.pop('item_prices_initial', [])
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
    
    def get_item_price_formset(self, data=None):
        """ItemPrice FormSet 반환"""
        if data:
            return ItemPriceFormSet(data, prefix='item_prices')
        else:
            # 수정 모드에서 기존 데이터로 초기화
            initial_data = self.item_prices_initial or []
            return ItemPriceFormSet(initial=initial_data, prefix='item_prices')

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