from django.urls import path
from . import views

app_name = 'ddoksang'

urlpatterns = [
    path('', views.bday_cafe_map, name='map'),  # 지도 메인 페이지
    path('api/bday_cafes/', views.bday_cafe_list_api, name='bday_cafe_list_api'),  # 테스트용 API
]