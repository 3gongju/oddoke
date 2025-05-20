# ✅ models.py (최적화된 버전)
from django.db import models
from django.conf import settings

class DdokdamPost(models.Model):
    CATEGORY_CHOICES = [
        ('community', '덕담 한마디'),
        ('food', '예절샷'),
        ('cafe', '생일카페'),
    ]

    title = models.CharField(max_length=100)
    content = models.TextField()
    image = models.ImageField(upload_to='ddokdam/image')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)

    idol = models.CharField(max_length=200, blank=True, null=True)
    hashtags = models.CharField(max_length=200, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    cafe_name = models.CharField(max_length=255, blank=True, null=True)
    cafe_location = models.CharField(max_length=255, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title}"


class DdokdamComment(models.Model):
    content = models.CharField(max_length=200)
    post = models.ForeignKey(DdokdamPost, on_delete=models.CASCADE, related_name='ddokdamcomment')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.content


# ✅ forms.py (카테고리별 필수 항목 지정)
from django import forms
from .models import DdokdamPost, DdokdamComment

class CommunityPostForm(forms.ModelForm):
    idol = forms.CharField(required=True)

    class Meta:
        model = DdokdamPost
        fields = ['title', 'content', 'image', 'idol']


class FoodPostForm(forms.ModelForm):
    location = forms.CharField(required=True)

    class Meta:
        model = DdokdamPost
        fields = ['title', 'content', 'image', 'location']


class CafePostForm(forms.ModelForm):
    idol = forms.CharField(required=True)
    cafe_name = forms.CharField(required=True)
    cafe_location = forms.CharField(required=True)
    start_date = forms.DateField(required=True)
    end_date = forms.DateField(required=True)

    class Meta:
        model = DdokdamPost
        fields = ['title', 'content', 'image', 'idol', 'cafe_name', 'cafe_location', 'start_date', 'end_date']


class DdokdamCommentForm(forms.ModelForm):
    class Meta:
        model = DdokdamComment
        fields = ['content']
