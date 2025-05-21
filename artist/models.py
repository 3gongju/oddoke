from django.db import models
from django_resized import ResizedImageField

# Create your models here.
class Artist(models.Model):
    display_name = models.CharField(max_length=100, unique=True, help_text="유저에게 보여줄 대표 이름")
    korean_name = models.CharField(max_length=100, blank=True, null=True, help_text="한글명")
    english_name = models.CharField(max_length=100, blank=True, null=True, help_text="영문명")
    alias = models.CharField(max_length=100, blank=True, null=True, help_text="줄임말 또는 별칭")
    logo = models.CharField(max_length=255, blank=True, null=True, help_text='static/image 경로 기준')
    # 솔로 아티스트일 경우 True, 그룹일 경우 False (생략 가능한데 일단 넣어둠)
    is_solo = models.BooleanField(default=False, help_text="솔로 아티스트인지 여부")
    
    def __str__(self):
        return self.display_name

# class Member(models.Model):
#     group = models.ForeignKey(Artist, on_delete=models.CASCADE, related_name='members')
#     name = models.CharField(max_length=100)

#     def __str__(self):
#         return f"{self.name} ({self.group.display_name})"
class Member(models.Model):
    groups = models.ManyToManyField(Artist, related_name='members', help_text="소속 그룹/유닛")
    name = models.CharField(max_length=100, help_text="멤버 이름")
    bday = models.DateField(blank=True, null=True, help_text="생년월일")
    
    def __str__(self):
        return self.name