from django.contrib import admin
from .models import BdayCafe, CafeFavorite, TourPlan, TourStop, UserSearchHistory
from django.utils import timezone


@admin.action(description="선택한 생일카페를 승인합니다")
def approve_cafes(modeladmin, request, queryset):
    queryset.update(status='approved', verified_by=request.user, verified_at=timezone.now())


@admin.action(description="선택한 생일카페를 거절합니다")
def reject_cafes(modeladmin, request, queryset):
    queryset.update(status='rejected', verified_by=request.user, verified_at=timezone.now())


@admin.register(BdayCafe)
class BdayCafeAdmin(admin.ModelAdmin):
    list_display = ('cafe_name', 'artist', 'member', 'start_date', 'end_date', 'status', 'is_featured', 'view_count')
    list_filter = ('status', 'cafe_type', 'start_date', 'artist')
    search_fields = ('cafe_name', 'address', 'artist__display_name', 'member__member_name')
    readonly_fields = ('created_at', 'updated_at', 'verified_at', 'verified_by')
    actions = [approve_cafes, reject_cafes]


@admin.register(CafeFavorite)
class CafeFavoriteAdmin(admin.ModelAdmin):
    list_display = ('user', 'cafe', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'cafe__cafe_name')


@admin.register(TourPlan)
class TourPlanAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'tour_date', 'transportation_mode', 'is_public')
    list_filter = ('transportation_mode', 'tour_date')
    search_fields = ('user__username', 'name')


@admin.register(TourStop)
class TourStopAdmin(admin.ModelAdmin):
    list_display = ('tour', 'cafe', 'order', 'estimated_stay_duration')
    list_filter = ('tour__tour_date',)
    search_fields = ('tour__name', 'cafe__cafe_name')


@admin.register(UserSearchHistory)
class UserSearchHistoryAdmin(admin.ModelAdmin):
    list_display = ('user', 'search_query', 'search_type', 'created_at')
    list_filter = ('search_type', 'created_at')
    search_fields = ('search_query', 'user__username')
