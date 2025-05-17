from django.urls import path
from . import views

app_name = 'ddokfarm'

urlpatterns = [
    path('', views.index, name='index'),
    path('create/', views.create, name='create'),
    path('<int:post_id>/', views.detail, name='detail'),  # detail URL 패턴 수정
    path('<int:id>/update/', views.update, name='update'),
    path('<int:id>/delete/', views.delete, name='delete'),
    path('<int:id>/mark_as_sold/', views.mark_as_sold, name='mark_as_sold'),
    
    # 댓글 관리
    path('<int:post_id>/comments/create', views.comment_create, name='comment_create'),
    path('<int:post_id>/comments/<int:id>/delete', views.comment_delete, name='comment_delete'),
]