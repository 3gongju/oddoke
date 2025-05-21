from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from .models import Artist

class ArtistResource(resources.ModelResource):
	class Meta:
		model = Artist
		fields = ('id', 'display_name', 'english_name', 'korean_name', 'alias')
		export_order = fields


class ArtistAdmin(ImportExportModelAdmin):
	fields = ('display_name', 'english_name', 'korean_name', 'alias')
	list_display = ('id', 'display_name', 'english_name', 'korean_name', 'alias')
	resource_class = ArtistResource

admin.site.register(Artist, ArtistAdmin)