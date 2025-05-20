from django.contrib import admin
from .models import DdokfarmPost, DdokfarmComment, Category

# Register your models here.
admin.site.register(DdokfarmPost)
admin.site.register(DdokfarmComment)

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')  # 리스트 화면에서 보이게
    prepopulated_fields = {"slug": ("name",)}  # name 입력 시 slug 자동 생성되게 (옵션)