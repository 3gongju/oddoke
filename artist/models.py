from django.db import models

# Create your models here.
class Artist(models.Model):
    display_name = models.CharField(max_length=100, unique=True, help_text="유저에게 보여줄 대표 이름")
    korean_name = models.CharField(max_length=100, blank=True, null=True, help_text="한글명")
    english_name = models.CharField(max_length=100, blank=True, null=True, help_text="영문명")
    alias = models.CharField(max_length=100, blank=True, null=True, help_text="줄임말 또는 별칭")

    def __str__(self):
        return self.display_name

# class Member(models.Model):
#     group = models.ForeignKey(Artist, on_delete=models.CASCADE, related_name='members')
#     name = models.CharField(max_length=100)

#     def __str__(self):
#         return f"{self.name} ({self.group.display_name})"