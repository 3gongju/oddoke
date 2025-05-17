from django.db import models
from django.conf import settings

class DdokdamPost(models.Model):
    CATEGORY_CHOICES = [  # 여기에 따로 정의해야 views.py에서 참조 가능
        ('community', '덕담 한마디'),
        ('food', '예절 차리기'),
        ('cafe', '덕생 후기'),
    ]

    title = models.CharField(max_length=200)
    content = models.TextField()
    image = models.ImageField(upload_to='ddokdam/', blank=True, null=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        return self.title


class DdokdamComment(models.Model):
    post = models.ForeignKey(DdokdamPost, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.content
