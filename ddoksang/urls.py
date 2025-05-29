from django.urls import path
from . import views

app_name = "ddoksang"

urlpatterns = [
    path('', views.home_view, name='home'),
    path('create/', views.bday_cafe_create, name='create'),  # 폼 페이지 렌더링(GET)
    path('create/submit/', views.create_cafe, name='create_submit'),  # 등록 처리(POST)
    path('my_cafes/', views.my_cafes, name='my_cafes'),
    path('detail/<int:cafe_id>/', views.bday_cafe_detail, name='detail'),
    path('api/list/', views.bday_cafe_list_api, name='api_list'),
    path('toggle_favorite/<int:cafe_id>/', views.toggle_favorite, name='toggle_favorite'),
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
