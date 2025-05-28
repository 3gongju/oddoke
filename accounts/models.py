from django.db import models
from django.contrib.auth.models import AbstractUser
from django_resized import ResizedImageField
from artist.models import Artist
from django.conf import settings

# Create your models here.
class User(AbstractUser):
    email = models.EmailField(unique=True, error_messages={
        'unique': "이미 사용중인 이메일입니다."
    })
    username = models.CharField(max_length=20, unique=True, error_messages={
        'unique': "이미 사용 중인 닉네임입니다."
    })

    profile_image = ResizedImageField(
        size=[500, 500],
        crop=['middle', 'center'],
        upload_to='profile',
    )
    followings = models.ManyToManyField('self', related_name ='followers', symmetrical=False) # 반대쪽에서 어떻게 부를지
    bio = models.TextField(blank=True, null=True)

class MannerReview(models.Model):
    RATING_CHOICES = [(i, f'{i}점') for i in range(1, 6)]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='manner_reviews')
    target_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_received')
    rating = models.IntegerField(choices=RATING_CHOICES)
    punctuality = models.CharField(max_length=50)
    description_match = models.CharField(max_length=50)
    response_speed = models.CharField(max_length=50)
    politeness = models.CharField(max_length=50)
    deal_again = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} → {self.target_user} ({self.rating}점)"

def default_profile_image():
    return 'profile/default.png'  # media/profile/default.png 경로

profile_image = models.ImageField(upload_to='profile/', blank=True, null=True, default=default_profile_image)
