

# class ArtistResource(resources.ModelResource):
#     logo = fields.Field(column_name='logo')

#     def import_row(self, row, instance_loader, **kwargs):
#         instance = instance_loader.get_instance(row)
#         if instance is None:
#             instance = self.get_instance(row)

#         # 이미지 파일 처리
#         file_path = row.get('logo')
#         if file_path and os.path.exists(file_path):
#             filename = os.path.basename(file_path)
#             with open(file_path, 'rb') as f:
#                 instance.logo.save(filename, File(f), save=False)
#             # 덮어쓰기 방지: row['logo'] 값을 제거
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

# from django.contrib import admin
# from import_export import resources, fields
# from import_export.admin import ImportExportModelAdmin
# from import_export.widgets import ManyToManyWidget
# from .models import Artist, Member
# from artist.models import Member
# # Artist 관련 설정
# class ArtistResource(resources.ModelResource):
#     class Meta:
#         model = Artist

# @admin.register(Artist)
# class ArtistAdmin(ImportExportModelAdmin):
#     resource_classes = [ArtistResource]
    
# Member 관련 설정
# class MemberResource(resources.ModelResource):
#     artist_display_name = fields.Field(
#         column_name='artist_display_name',
#         attribute='artist_display_name',
#         widget=ManyToManyWidget(Artist, field='display_name')
#     )

#     class Meta:
#         model = Member
#         fields = ('artist_display_name', 'member_name', 'member_bday')
#         import_id_fields = ('member_name',)  #  고유성 판단 기준은 이름만! 이름이 같은 멤버들...예를 들어..마크..마크..마크

# # MemberAdmin 설정
# @admin.register(Member)
# class MemberAdmin(ImportExportModelAdmin):
#     resource_class = MemberResource
#     list_display = ('member_name', 'member_bday')
#     filter_horizontal = ('artist_display_name',)
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

# Member 리소스
class MemberResource(resources.ModelResource):
    artist_name = fields.Field(
        column_name='artist_name',   # CSV의 컬럼 헤더
        attribute='artist_name',     # Member 모델의 필드명
        widget=ManyToManyWidget(Artist, field='display_name')  # Artist.display_name 기준 매핑
    )

    class Meta:
        model = Member
        fields = ('artist_name', 'member_name', 'member_bday')
        import_id_fields = ('member_name',)

# Member Admin 등록
@admin.register(Member)
class MemberAdmin(ImportExportModelAdmin):
    resource_class = MemberResource

    # 여기서 ManyToMany 필드를 직접 보여주기 위한 메서드 추가
    def get_artist_names(self, obj):
        return ", ".join([artist.display_name for artist in obj.artist_name.all()])
    get_artist_names.short_description = 'Artist(s)'  # Django admin 목록에서 컬럼 제목 설정

    list_display = ('member_name', 'member_bday', 'get_artist_names')
    filter_horizontal = ('artist_name',)