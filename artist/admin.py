from django.contrib import admin
from import_export import resources, fields
from import_export.admin import ImportExportModelAdmin
from .models import Artist
import os
from django.core.files import File

# class ArtistResource(resources.ModelResource):
#     logo = fields.Field(column_name='logo')

#     def import_row(self, row, instance_loader, **kwargs):
#         instance = instance_loader.get_instance(row)
#         if instance is None:
#             instance = self.get_instance(row)

#         # ✅ 이미지 파일 처리
#         file_path = row.get('logo')
#         if file_path and os.path.exists(file_path):
#             filename = os.path.basename(file_path)
#             with open(file_path, 'rb') as f:
#                 instance.logo.save(filename, File(f), save=False)
#             # ✅ 덮어쓰기 방지: row['logo'] 값을 제거
#             row['logo'] = None  # ← 여기가 핵심! 문자열 경로를 덮어쓰지 않게 차단

#         return super().import_row(row, instance_loader, instance=instance, **kwargs)

#     class Meta:
#         model = Artist
#         fields = ('id', 'display_name', 'english_name', 'korean_name', 'alias', 'logo')
#         export_order = fields

# class ArtistAdmin(ImportExportModelAdmin):
# 	fields = ('display_name', 'english_name', 'korean_name', 'alias', 'logo')
# 	list_display = ('id', 'display_name', 'english_name', 'korean_name', 'alias', 'logo')
# 	resource_class = ArtistResource

# admin.site.register(Artist, ArtistAdmin)


from django.contrib import admin
from .models import Artist
from import_export.admin import ImportExportModelAdmin

class ArtistResource(resources.ModelResource):
    class Meta:
        model = Artist

@admin.register(Artist)
class ArtistAdmin(ImportExportModelAdmin):
    resource_classes = [ArtistResource]