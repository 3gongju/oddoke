from django.db import models
from django.contrib.auth.models import AbstractUser
from django_resized import ResizedImageField

# Create your models here.
class User(AbstractUser):
    profile_image = ResizedImageField(
        size=[500, 500],
        crop=['middle', 'center'],
        upload_to='profile',
    )

    # post_set
    # comment_set
    # post_set => like_posts(MMF)
    followings = models.ManyToManyField('self', related_name ='followers', symmetrical=False) # 반대쪽에서 어떻게 부를지
    # user_set(반대쪽) => followers(user_set 이름 변경)
    # symmetrical=False : 비대칭구조 (1-> 2 팔로우 / 2 ->1 팔로우는 다르기 때문)