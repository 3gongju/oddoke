from django.urls import path
from . import views

app_name = 'ddokdam'

urlpatterns = [
    path('', views.index, name='index'),
    path('category/<str:category>/', views.category_list, name='category_list'),
    path('create/', views.create, name='create'),
    path('post/<int:post_id>/', views.detail, name='detail'),  # ddokfarm의 detail과 구분하기 위해 'post'를 추가
    path('<int:post_id>/update/', views.update, name='update'),
    path('<int:post_id>/delete/', views.delete, name='delete'),
    path('<int:post_id>/comments/create/', views.comment_create, name='comment_create'),
    path('<int:post_id>/comments/<int:comment_id>/delete/', views.comment_delete, name='comment_delete'),
    path('<int:post_id>/like/', views.like, name='like'),
]
