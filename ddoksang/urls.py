from django.urls import path
from . import views

app_name = 'ddoksang'

urlpatterns = [
    # 일반 사용자 URLs
    path('', views.map_view, name='map'),
    path('create/', views.create_cafe, name='create'),
    path('my-cafes/', views.my_cafes, name='my_cafes'),
    path('cafes/', views.cafe_list_view, name='cafe_list'),

    
    
    # # API URLs
    
    # path('api/create/', views.create_api, name='create_api'),
    # path('api/cafes/', views.get_approved_cafes_json, name='cafes_json'),
    # path('api/cafe/<int:cafe_id>/', views.cafe_detail_popup, name='cafe_detail_popup'),
   
    
    # 관리자 URLs
    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin-cafes/', views.admin_cafe_list, name='admin_cafe_list'),
    path('admin-cafe/<int:cafe_id>/', views.admin_cafe_detail, name='admin_cafe_detail'),
    path('admin-approve/<int:cafe_id>/', views.approve_cafe, name='approve_cafe'),
    path('admin-reject/<int:cafe_id>/', views.reject_cafe, name='reject_cafe'),
    path('admin-bulk-action/', views.bulk_action, name='bulk_action'),
]