from django.urls import path
from . import views
import ddoksang.views.cafe_views as cafe_views 

app_name = 'ddoksang'

urlpatterns = [
    # === 기본 페이지 ===
    path('', views.home_view, name='home'),
    path('map/', views.map_view, name='map'),
    path('search/', views.search_view, name='search'),
    # path('list/', views.cafe_list_view, name='cafe_list'),
   path('tour_map/', cafe_views.tour_map_view, name='tour_map'),
    
    # === 카페 상세/등록 ===
    path('create/', views.cafe_create_view, name='create'),
    path('create/success/<int:cafe_id>/', views.cafe_create_success, name='cafe_create_success'),
    path('cafe/<int:cafe_id>/', views.cafe_detail_view, name='detail'),
    path('cafe/<int:cafe_id>/edit/', views.cafe_edit_view, name='edit'),
    
    # === 사용자 기능 ===
    path('my-cafes/', views.my_cafes, name='my_cafes'),
    path('favorites/', views.my_favorites_view, name='favorites'),
    path('cafe/<int:cafe_id>/toggle-favorite/', views.toggle_favorite, name='toggle_favorite'),


    

    # === 미리보기 ===
    path('preview/user/<int:cafe_id>/', views.user_preview_cafe, name='user_preview'),
    path('preview/admin/<int:cafe_id>/', views.admin_preview_cafe, name='admin_preview'),
    
    # === API 엔드포인트 ===
    path('api/cafes/', views.bday_cafe_list_api, name='cafe_list_api'),
    path('api/cafe/<int:cafe_id>/quick/', views.cafe_quick_view, name='cafe_quick_api'),
    path('api/nearby/', views.nearby_cafes_api, name='nearby_cafes_api'),
    path('api/map-data/', views.cafe_map_data_api, name='map_data_api'),
    path('api/search-suggestions/', views.search_suggestions_api, name='search_suggestions_api'),
    
    # === 관리자 기능 ===
    path('admin/dashboard/', views.admin_dashboard_view, name='admin_dashboard'),
    path('admin/cafes/', views.admin_cafe_list, name='admin_cafe_list'),
    path('admin/cafe/<int:cafe_id>/approve/', views.approve_cafe, name='admin_approve_cafe'),
    path('admin/cafe/<int:cafe_id>/reject/', views.reject_cafe, name='admin_reject_cafe'),

    
    # === 이미지 관리 ===
    path('image/upload/', views.cafe_image_upload_view, name='image_upload'),
    path('image/<int:image_id>/delete/', views.cafe_image_delete_view, name='image_delete'),
]