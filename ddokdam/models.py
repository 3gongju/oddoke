from django.db import models
from django.conf import settings

class DdokdamPost(models.Model):
    CATEGORY_CHOICES = [
        ('community', '덕담 한마디'),
        ('food', '예절 차리기(예절샷)'),
        ('cafe', '덕생 후기'),
    ]

    title = models.CharField(max_length=100)
    content = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    image = models.ImageField(upload_to='ddokdam/')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class DdokdamComment(models.Model):
    post = models.ForeignKey(DdokdamPost, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.content
