# ddokchat/forms.py
from django import forms
from .models import TradeReport


class TradeReportForm(forms.ModelForm):
    """덕팜 거래 사기 신고 폼"""
    
    class Meta:
        model = TradeReport
        fields = ['reason', 'description', 'evidence_text', 'damage_amount']
        widgets = {
            'reason': forms.RadioSelect(attrs={
                'class': 'space-y-3'
            }),
            'description': forms.Textarea(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500',
                'rows': 4,
                'placeholder': '구체적인 신고 사유를 작성해주세요 (필수)',
                'required': True,
            }),
            'evidence_text': forms.Textarea(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500',
                'rows': 3,
                'placeholder': '추가 증거나 설명이 있다면 작성해주세요 (선택사항)',
            }),
            'damage_amount': forms.NumberInput(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500',
                'placeholder': '피해 금액을 입력하세요 (원)',
                'min': '0',
                'step': '1000',
            }),
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['reason'].label = '신고 사유'
        self.fields['description'].label = '신고 내용'
        self.fields['evidence_text'].label = '추가 증거/설명'
        self.fields['evidence_text'].required = False
        self.fields['damage_amount'].label = '피해 금액'
        self.fields['damage_amount'].required = False
        
        # 도움말 텍스트 설정
        self.fields['damage_amount'].help_text = '사기로 인한 실제 피해 금액을 입력하세요'
    
    def clean_description(self):
        description = self.cleaned_data.get('description')
        if not description or len(description.strip()) < 10:
            raise forms.ValidationError('신고 내용을 10자 이상 구체적으로 작성해주세요.')
        return description.strip()
    
    def clean_damage_amount(self):
        damage_amount = self.cleaned_data.get('damage_amount')
        if damage_amount is not None and damage_amount < 0:
            raise forms.ValidationError('피해 금액은 0원 이상이어야 합니다.')
        return damage_amount