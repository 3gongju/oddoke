from django.urls import path
from . import views

app_name = 'ddoksang'

urlpatterns = [
    # 🗺️ 메인 지도 페이지 - 새로운 함수 사용
    path('', views.bday_cafe_map, name='map'),
    
    # 📝 생일카페 등록 관련
    path('create/form/', views.create_bday_cafe_form, name='create_bday_cafe_form'),  # 등록 폼 페이지
    path('create/', views.create_bday_cafe, name='create_bday_cafe'),                # JSON API 등록
    path('create/old/', views.create_cafe, name='create_old'),                      # 기존 폼 방식 (백업용)
    
    # 👤 사용자 페이지
    path('my-cafes/', views.my_cafes, name='my_cafes'),
    path('cafes/', views.cafe_list_view, name='cafe_list'),
    
    # 🔗 API URLs
    path('api/bday_cafes/', views.bday_cafe_list_api, name='bday_cafe_list_api'),
    
    # 🛠️ 관리자 URLs
    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin-cafes/', views.admin_cafe_list, name='admin_cafe_list'),
    path('admin-cafe/<int:cafe_id>/', views.admin_cafe_detail, name='admin_cafe_detail'),
    path('admin-approve/<int:cafe_id>/', views.approve_cafe, name='approve_cafe'),
    path('admin-reject/<int:cafe_id>/', views.reject_cafe, name='reject_cafe'),
    path('admin-bulk-action/', views.bulk_action, name='bulk_action'),
]