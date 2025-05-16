# ddokdam/models.py
from django.db import models
from django_resized import ResizedImageField
from django.conf import settings

class DdokdamPost(models.Model):
    CATEGORY_CHOICES = [
        ('community', '덕담 남기기'),
        ('food', '예절샷으로 예절 차리기'),
        ('cafe', '덕생 후기 남기기'),
    ]
    
    title = models.CharField(max_length=100)
    content = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='community')
    image = ResizedImageField(size=[800, 800], crop=['middle', 'center'], upload_to='ddokdam')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='ddokdam_liked_posts', blank=True)
    
    def __str__(self):
        return self.title
    
    def comment_count(self):
        return self.ddokdamcomment_set.count()
    
    def like_count(self):
        return self.likes.count()

class DdokdamComment(models.Model):
    content = models.CharField(max_length=200)
    post = models.ForeignKey(DdokdamPost, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.content