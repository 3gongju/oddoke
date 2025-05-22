from django.contrib import admin
from import_export import resources, fields
from import_export.admin import ImportExportModelAdmin
from import_export.widgets import ManyToManyWidget
from .models import Artist, Member


# Artist 관련 설정
class ArtistResource(resources.ModelResource):
    class Meta:
        model = Artist

@admin.register(Artist)
class ArtistAdmin(ImportExportModelAdmin):
    resource_class = ArtistResource


# Member Resource: member_name + artist_name 복합 키 대응
# Member Resource
class MemberResource(resources.ModelResource):
    artist_name = fields.Field(
        column_name='artist_name',
        attribute='artist_name',
        widget=ManyToManyWidget(Artist, field='display_name')
    )

    class Meta:
        model = Member
        fields = ('artist_name', 'member_name', 'member_bday')
        import_id_fields = ()

    def get_instance(self, instance_loader, row):
        member_name = row.get('member_name')
        artist_names_raw = row.get('artist_name')

        if not member_name or not artist_names_raw:
            return None

        if isinstance(artist_names_raw, dict):
            artist_names = list(artist_names_raw.values())
        else:
            artist_names = [name.strip() for name in str(artist_names_raw).split(',')]

        candidates = Member.objects.filter(member_name=member_name)
        for artist_name in artist_names:
            candidates = candidates.filter(artist_name__display_name=artist_name)

        return candidates.first()

# Member Admin 등록
@admin.register(Member)
class MemberAdmin(ImportExportModelAdmin):
    resource_class = MemberResource
    list_display = ('member_name', 'member_bday', 'get_artist_names')  # ✅ 여기에 표시 컬럼 추가
    filter_horizontal = ('artist_name',)

    def get_artist_names(self, obj):
        return ", ".join([a.display_name for a in obj.artist_name.all()])
    get_artist_names.short_description = "아티스트 이름"