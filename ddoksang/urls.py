from django.urls import path
from . import views

app_name = "ddoksang"

urlpatterns = [
    path('', views.home_view, name='home'),
    path('create/', views.create_cafe, name='create'),
    path('create/success/<int:cafe_id>/', views.cafe_create_success, name='create_success'),
    path('my_cafes/', views.my_cafes, name='my_cafes'),
    
    # 카페 상세 보기 (승인된 것과 미승인된 것 모두 처리)
    path('detail/<int:cafe_id>/', views.bday_cafe_detail, name='detail'),
    
    # 미리보기 (기존 함수 재사용)
   
    path('user_preview/<int:cafe_id>/', views.user_preview_cafe, name='user_preview'),
    path('admin_preview/<int:cafe_id>/', views.admin_preview_cafe, name='admin_preview'),

    
    # API
    path('api/list/', views.bday_cafe_list_api, name='api_list'),
    path('api/nearby/', views.nearby_cafes_api, name='nearby_cafes_api'),
    path('toggle_favorite/<int:cafe_id>/', views.toggle_favorite, name='toggle_favorite'),
    
    # 검색 및 지도
    path('search/', views.search_view, name='search'),
    path('tour_map/', views.map_view, name='tour_map'),
    
    # 관리자 페이지
    path('admin/dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin/cafe_list/', views.admin_cafe_list, name='admin_cafe_list'),
    path('admin/approve/<int:cafe_id>/', views.approve_cafe, name='admin_approve_cafe'),
    path('admin/reject/<int:cafe_id>/', views.reject_cafe, name='admin_reject_cafe'),

    # 자동완성 API
    path('autocomplete/members/', views.member_autocomplete, name='member_autocomplete'),
]