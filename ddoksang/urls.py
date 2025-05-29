from django.urls import path
from . import views
# 

app_name = 'ddoksang'

urlpatterns = [
    path('', views.home_view, name='home'),  # 덕생 메인
    path('map/', views.map_view, name='tour_map'),  # 생카 투어맵
    path('create/', views.create_cafe, name='create'),  # 생카 등록
    path('my-cafes/', views.my_cafes, name='my_cafes'),  # 내 생카
    path('detail/<int:cafe_id>/', views.bday_cafe_detail, name='detail'),  # 상세 뷰
    path('api/bday-cafes/', views.bday_cafe_list_api, name='cafe_list_api'),  # 생카 JSON API

    path('autocomplete/members/', views.member_autocomplete, name='member_autocomplete'),
    
    # 찜하기
    path('favorite/<int:cafe_id>/toggle/', views.toggle_favorite, name='toggle_favorite'),

    # 관리자
    path('admin/dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin/cafes/', views.admin_cafe_list, name='admin_cafe_list'),
    path('admin/cafes/<int:cafe_id>/approve/', views.approve_cafe, name='approve_cafe'),
    path('admin/cafes/<int:cafe_id>/reject/', views.reject_cafe, name='reject_cafe'),

    # (추후 필요 시 추가) 검색 결과 뷰
    path('search/', views.search_view, name='search'),  # 🔍 검색창과 연결
]
