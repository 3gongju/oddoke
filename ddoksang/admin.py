# ddoksang/admin.py
# admin 등록은 여기서만!
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.contrib import messages
from django.utils import timezone
from .models import BdayCafe, CafeFavorite, TourPlan, TourStop, UserSearchHistory

@admin.register(BdayCafe)
class BdayCafeAdmin(admin.ModelAdmin):
    list_display = [
        'cafe_name', 'artist', 'member', 'cafe_type', 
        'start_date', 'end_date', 'status', 'submitted_by', 
        'created_at', 'view_count', 'admin_actions'
    ]
    list_filter = [
        'status', 'cafe_type', 'artist', 'created_at', 
        'start_date', 'is_featured'
    ]
    search_fields = [
        'cafe_name', 'artist__name', 'member__name', 
        'address', 'submitted_by__username'
    ]
    readonly_fields = [
        'submitted_by', 'created_at', 'updated_at', 
        'view_count', 'verified_at', 'verified_by'
    ]
    
    fieldsets = (
        ('기본 정보', {
            'fields': (
                'submitted_by', 'artist', 'member', 'cafe_type', 'status'
            )
        }),
        ('카페 정보', {
            'fields': (
                'cafe_name', 'address', 'road_address', 'detailed_address',
                'phone', 'latitude', 'longitude'
            )
        }),
        ('카카오맵 연동 정보', {
            'fields': (
                'kakao_place_id', 'place_url', 'category_name'
            ),
            'classes': ('collapse',)
        }),
        ('이벤트 정보', {
            'fields': (
                'start_date', 'end_date', 'start_time', 'end_time',
                'special_benefits', 'event_description', 'hashtags'
            )
        }),
        ('이미지', {
            'fields': ('main_image', 'poster_image')
        }),
        ('출처', {
            'fields': ('twitter_source', 'instagram_source')
        }),
        ('관리 정보', {
            'fields': (
                'is_featured', 'view_count', 'verified_at', 'verified_by',
                'created_at', 'updated_at'
            ),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['approve_cafes', 'reject_cafes', 'feature_cafes']
    
    def admin_actions(self, obj):
        """관리자 액션 버튼"""
        if obj.status == 'pending':
            approve_url = reverse('admin:approve_cafe', args=[obj.pk])
            reject_url = reverse('admin:reject_cafe', args=[obj.pk])
            return format_html(
                '<a class="button" href="{}">승인</a> '
                '<a class="button" href="{}">거절</a>',
                approve_url, reject_url
            )
        elif obj.status == 'approved':
            return format_html('<span style="color: green;">✓ 승인됨</span>')
        elif obj.status == 'rejected':
            return format_html('<span style="color: red;">✗ 거절됨</span>')
        return '-'
    admin_actions.short_description = '액션'
    
    def approve_cafes(self, request, queryset):
        """일괄 승인"""
        updated = queryset.filter(status='pending').update(
            status='approved',
            verified_at=timezone.now(),
            verified_by=request.user
        )
        self.message_user(
            request, 
            f'{updated}개의 생일카페가 승인되었습니다.',
            messages.SUCCESS
        )
    approve_cafes.short_description = "선택된 생일카페 승인"
    
    def reject_cafes(self, request, queryset):
        """일괄 거절"""
        updated = queryset.filter(status='pending').update(
            status='rejected',
            verified_at=timezone.now(),
            verified_by=request.user
        )
        self.message_user(
            request,
            f'{updated}개의 생일카페가 거절되었습니다.',
            messages.WARNING
        )
    reject_cafes.short_description = "선택된 생일카페 거절"
    
    def feature_cafes(self, request, queryset):
        """추천 생카로 설정"""
        updated = queryset.update(is_featured=True)
        self.message_user(
            request,
            f'{updated}개의 생일카페가 추천 생카로 설정되었습니다.',
            messages.SUCCESS
        )
    feature_cafes.short_description = "추천 생카로 설정"
    
    def get_queryset(self, request):
        """쿼리셋 최적화"""
        return super().get_queryset(request).select_related(
            'artist', 'member', 'submitted_by', 'verified_by'
        )

@admin.register(CafeFavorite)
class CafeFavoriteAdmin(admin.ModelAdmin):
    list_display = ['user', 'cafe', 'created_at']
    list_filter = ['created_at', 'cafe__artist']
    search_fields = ['user__username', 'cafe__cafe_name']

@admin.register(TourPlan)
class TourPlanAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'user', 'tour_date', 'total_stops', 
        'total_distance', 'is_public', 'created_at'
    ]
    list_filter = ['is_public', 'transportation_mode', 'created_at']
    search_fields = ['name', 'user__username']
    
    def total_stops(self, obj):
        return obj.tourstop_set.count()
    total_stops.short_description = '총 경유지'

@admin.register(TourStop)
class TourStopAdmin(admin.ModelAdmin):
    list_display = ['tour', 'cafe', 'order', 'estimated_stay_duration']
    list_filter = ['tour__tour_date', 'cafe__artist']
    ordering = ['tour', 'order']

@admin.register(UserSearchHistory)
class UserSearchHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'search_query', 'search_type', 'created_at']
    list_filter = ['search_type', 'created_at']
    search_fields = ['user__username', 'search_query']
    readonly_fields = ['created_at']