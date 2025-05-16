from django.contrib import admin
from .models import DdokdamPost, DdokdamComment

# Register your models here.
admin.site.register(DdokdamPost)
admin.site.register(DdokdamComment)