from django.db import models
from django_resized import ResizedImageField
from django.conf import settings

class Post(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    image = ResizedImageField(
        size=[500, 500],
        crop=['middle', 'center'],
        upload_to='image'
    )