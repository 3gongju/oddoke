from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import BdayCafe, CafeFavorite



@admin.register(BdayCafe)
class BdayCafeAdmin(admin.ModelAdmin):
    list_display = [
        'cafe_name', 'artist', 'member', 'status', 'image_count_display', 
        'start_date', 'end_date', 'created_at'
    ]
    list_filter = ['status', 'cafe_type', 'artist', 'created_at']
    search_fields = ['cafe_name', 'artist__display_name', 'member__member_name']
    readonly_fields = [
        'created_at', 'updated_at', 'view_count', 
        'image_gallery_display', 'image_preview'
    ]
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('submitted_by', 'artist', 'member', 'cafe_type', 'status')
        }),
        ('카페 정보', {
            'fields': ('cafe_name', 'place_name', 'address', 'road_address', 
                       'latitude', 'longitude')
        }),
        ('운영 정보', {
            'fields': ('start_date', 'end_date')
        }),
        ('상세 정보', {
            'fields': ('special_benefits', 'event_description', 'x_source')
        }),
        ('이미지 갤러리', {
            'fields': ('image_gallery', 'image_gallery_display', 'image_preview'),
            'classes': ('wide',)
        }),
        ('시스템 정보', {
            'fields': ('view_count', 'created_at', 'updated_at', 
                      'verified_at', 'verified_by'),
            'classes': ('collapse',)
        })
    )
    
    
    def image_count_display(self, obj):
        """이미지 개수 표시"""
        count = obj.image_count
        if count > 0:
            return format_html(
                '<span style="color: green; font-weight: bold;">{}장</span>',
                count
            )
        else:
            return format_html('<span style="color: red;">없음</span>')
    
    image_count_display.short_description = '이미지'
    
    def image_gallery_display(self, obj):
        """이미지 갤러리 JSON 정보 표시"""
        if not obj.image_gallery:
            return mark_safe('<em>이미지 없음</em>')
        
        html = '<div style="max-width: 600px;">'
        html += f'<strong>총 {len(obj.image_gallery)}장의 이미지</strong><br><br>'
        
        for i, img_data in enumerate(obj.image_gallery):
            html += f'''
            <div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                <strong>이미지 {i + 1}:</strong><br>
                <strong>타입:</strong> {img_data.get('type', 'N/A')}<br>
                <strong>대표:</strong> {'예' if img_data.get('is_main', False) else '아니오'}<br>
                <strong>순서:</strong> {img_data.get('order', 'N/A')}<br>
                <strong>크기:</strong> {img_data.get('width', 'N/A')} x {img_data.get('height', 'N/A')}<br>
                <strong>파일 크기:</strong> {self._format_file_size(img_data.get('file_size', 0))}<br>
                <strong>URL:</strong> <a href="{img_data.get('url', '#')}" target="_blank">링크</a>
            </div>
            '''
        
        html += '</div>'
        return mark_safe(html)
    
    image_gallery_display.short_description = '이미지 갤러리 정보'
    
    def image_preview(self, obj):
        """이미지 미리보기"""
        if not obj.image_gallery:
            return mark_safe('<em>이미지 없음</em>')
        
        html = '<div style="display: flex; flex-wrap: wrap; gap: 10px; max-width: 800px;">'
        
        for i, img_data in enumerate(obj.image_gallery):
            url = img_data.get('url', '')
            is_main = img_data.get('is_main', False)
            img_type = img_data.get('type', 'other')
            
            if url:
                badge_style = 'background: red; color: white;' if is_main else 'background: blue; color: white;'
                badge_text = '대표' if is_main else img_type
                
                html += f'''
                <div style="position: relative; display: inline-block;">
                    <img src="{url}" 
                         style="width: 120px; height: 160px; object-fit: cover; border: 2px solid #ddd; border-radius: 5px;">
                    <div style="position: absolute; top: 5px; left: 5px; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; {badge_style}">
                        {badge_text}
                    </div>
                    <div style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; padding: 2px 4px; border-radius: 3px; font-size: 10px;">
                        {i + 1}
                    </div>
                </div>
                '''
        
        html += '</div>'
        return mark_safe(html)
    
    image_preview.short_description = '이미지 미리보기'
    
    def _format_file_size(self, size_bytes):
        """파일 크기 포맷팅"""
        if not size_bytes:
            return 'N/A'
        
        if size_bytes < 1024:
            return f'{size_bytes} B'
        elif size_bytes < 1024 * 1024:
            return f'{size_bytes / 1024:.1f} KB'
        else:
            return f'{size_bytes / (1024 * 1024):.1f} MB'
    
    def get_queryset(self, request):
        """쿼리셋 최적화"""
        return super().get_queryset(request).select_related('artist', 'member', 'submitted_by')

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
    

@admin.register(CafeFavorite)
class CafeFavoriteAdmin(admin.ModelAdmin):
    list_display = ['user', 'cafe', 'created_at']
    list_filter = ['created_at', 'cafe__artist']
    search_fields = ['user__username', 'cafe__cafe_name']
    readonly_fields = ['created_at']




# Admin 사이트 커스터마이징
admin.site.site_header = "최고 경영자 및 관리자"
admin.site.site_title = "덕생 관리자"
admin.site.index_title = "생카 관리 시스템"