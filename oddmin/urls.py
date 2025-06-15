from django.urls import path, include
from . import views

app_name = 'oddmin'

urlpatterns = [
    # === 메인 대시보드 ===
    path('', views.admin_dashboard, name='dashboard'),
    
    # === 생일카페 관리 ===
    path('cafes/', views.cafe_list, name='cafe_list'),
    path('cafes/<int:cafe_id>/', views.cafe_detail, name='cafe_detail'),
    path('cafes/<int:cafe_id>/approve/', views.approve_cafe, name='approve_cafe'),
    path('cafes/<int:cafe_id>/reject/', views.reject_cafe, name='reject_cafe'),
    
    # === 팬덤 인증 관리 ===
    path('fandom/', views.fandom_list, name='fandom_list'),
    path('fandom/<int:profile_id>/', views.fandom_detail, name='fandom_detail'),
    path('fandom/<int:profile_id>/approve/', views.approve_fandom, name='approve_fandom'),
    path('fandom/<int:profile_id>/reject/', views.reject_fandom, name='reject_fandom'),
]