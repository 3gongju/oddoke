from django.urls import path
from . import views

app_name = 'ddokfarm'

urlpatterns = [
    path('', views.index, name='index'),
    path('create/', views.create, name='create'),
    path('<int:post_id>/', views.detail, name='detail'),
    path('<int:post_id>/update/', views.update, name='update'),
    path('<int:post_id>/delete/', views.delete, name='delete'),
    path('<int:post_id>/mark_as_sold/', views.mark_as_sold, name='mark_as_sold'),
    
    # 찜하기 URL
    path('<int:post_id>/like/', views.toggle_like, name='toggle_like'),

    # 댓글 관련 URL
    path('<int:post_id>/comments/create/', views.comment_create, name='comment_create'),
    path('<int:post_id>/comments/<int:id>/delete/', views.comment_delete, name='comment_delete'),
]
