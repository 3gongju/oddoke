from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import BdayCafe, BdayCafeImage, CafeFavorite

class BdayCafeImageInline(admin.TabularInline):
    """생일카페 이미지 인라인"""
    model = BdayCafeImage
    extra = 1
    fields = ['image_preview', 'image', 'image_type', 'caption', 'order', 'is_main']
    readonly_fields = ['image_preview']
    ordering = ['order']
    
    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;" />',
                obj.image.url
            )
        return "이미지 없음"
    image_preview.short_description = "미리보기"

@admin.register(BdayCafeImage)
class BdayCafeImageAdmin(admin.ModelAdmin):
    list_display = ['cafe', 'image_type', 'is_main', 'order', 'image_preview', 'created_at']
    list_filter = ['image_type', 'is_main', 'created_at']
    search_fields = ['cafe__cafe_name', 'caption']
    list_editable = ['order', 'is_main']
    ordering = ['cafe', 'order']
    
    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" />',
                obj.image.url
            )
        return "없음"
    image_preview.short_description = "미리보기"

@admin.register(BdayCafe)
class BdayCafeAdmin(admin.ModelAdmin):
    list_display = [
        'cafe_name', 'artist', 'member', 'start_date', 'end_date', 
        'status', 'is_featured', 'view_count', 'image_count', 'created_at'
    ]
    list_filter = ['status', 'cafe_type', 'is_featured', 'start_date', 'created_at', 'artist']
    search_fields = ['cafe_name', 'address', 'artist__display_name', 'member__member_name']
    readonly_fields = [
        'created_at', 'updated_at', 'verified_at', 'verified_by', 
        'view_count', 'get_main_image_preview', 'get_images_gallery'
    ]
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('submitted_by', 'artist', 'member', 'cafe_type', 'status')
        }),
        ('카페 정보', {
            'fields': ('cafe_name', 'place_name', 'address', 'road_address', 'detailed_address')
        }),
        ('위치 정보', {
            'fields': ('latitude', 'longitude', 'kakao_place_id'),
            'classes': ('collapse',)
        }),
        ('일정 정보', {
            'fields': ('start_date', 'end_date', 'start_time', 'end_time')
        }),
        ('상세 정보', {
            'fields': ('event_description', 'special_benefits', 'hashtags')
        }),
        ('기존 이미지 (하위 호환)', {
            'fields': ('main_image', 'poster_image', 'get_main_image_preview'),
            'classes': ('collapse',)
        }),
        ('다중 이미지', {
            'fields': ('get_images_gallery',),
            'description': '새로운 다중 이미지 시스템을 사용합니다. 아래 인라인에서 이미지를 관리하세요.'
        }),
        ('출처', {
            'fields': ('x_source',)  # ← 튜플로 수정 (콤마 추가)
        }),
        ('관리 정보', {
            'fields': ('is_featured', 'view_count', 'verified_by', 'verified_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [BdayCafeImageInline]
    actions = ['approve_cafes', 'reject_cafes', 'mark_as_featured', 'unmark_as_featured']
    
    def get_main_image_preview(self, obj):
        main_image_url = obj.get_main_image()
        if main_image_url:
            return format_html(
                '<img src="{}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 8px;" />',
                main_image_url
            )
        return "이미지 없음"
    get_main_image_preview.short_description = "대표 이미지 미리보기"
    
    def get_images_gallery(self, obj):
        images = obj.images.all()
        if not images:
            return "업로드된 이미지가 없습니다."
        
        html = '<div style="display: flex; flex-wrap: wrap; gap: 10px;">'
        for img in images:
            html += f'''
                <div style="text-align: center;">
                    <img src="{img.image.url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;" />
                    <br>
                    <small>{img.get_image_type_display()}</small>
                    {' <strong>(메인)</strong>' if img.is_main else ''}
                </div>
            '''
        html += '</div>'
        return mark_safe(html)
    get_images_gallery.short_description = "이미지 갤러리"
    
    def image_count(self, obj):
        count = obj.images.count()
        legacy_count = 0
        if obj.main_image:
            legacy_count += 1
        if obj.poster_image:
            legacy_count += 1
        
        if legacy_count > 0:
            return f"{count}개 (+구버전 {legacy_count}개)"
        return f"{count}개"
    image_count.short_description = "이미지 수"
    
    @admin.action(description="선택한 생일카페를 승인합니다")
    def approve_cafes(self, request, queryset):
        from django.utils import timezone
        updated = queryset.update(
            status='approved', 
            verified_by=request.user, 
            verified_at=timezone.now()
        )
        self.message_user(request, f'{updated}개의 생일카페가 승인되었습니다.')
    
    @admin.action(description="선택한 생일카페를 거절합니다")
    def reject_cafes(self, request, queryset):
        from django.utils import timezone
        updated = queryset.update(
            status='rejected', 
            verified_by=request.user, 
            verified_at=timezone.now()
        )
        self.message_user(request, f'{updated}개의 생일카페가 거절되었습니다.')
    
    @admin.action(description="추천 생카로 설정")
    def mark_as_featured(self, request, queryset):
        updated = queryset.update(is_featured=True)
        self.message_user(request, f'{updated}개의 생일카페가 추천으로 설정되었습니다.')
    
    @admin.action(description="추천 생카 해제")
    def unmark_as_featured(self, request, queryset):
        updated = queryset.update(is_featured=False)
        self.message_user(request, f'{updated}개의 생일카페 추천이 해제되었습니다.')

@admin.register(CafeFavorite)
class CafeFavoriteAdmin(admin.ModelAdmin):
    list_display = ['user', 'cafe', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'cafe__cafe_name']
    raw_id_fields = ['user', 'cafe']




# Admin 사이트 커스터마이징
admin.site.site_header = "최고 경영자 및 관리자"
admin.site.site_title = "덕생 Admin"
admin.site.index_title = "생일카페 관리 시스템"