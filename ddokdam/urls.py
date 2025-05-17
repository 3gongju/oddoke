# ddokdam/urls.py
from django.urls import path
from . import views

app_name = 'ddokdam'

urlpatterns = [
    path('', views.index, name='index'),
    path('category/<str:category>/', views.category_list, name='category_list'),
    path('create/', views.create, name='create'),
<<<<<<< HEAD
    path('<int:post_id>/', views.detail, name='detail'),
    path('<int:post_id>/update/', views.update, name='update'),
    path('<int:post_id>/delete/', views.delete, name='delete'),
    path('<int:post_id>/comment/', views.comment_create, name='comment_create'),
]
=======
    path('<int:id>/', views.detail, name='detail'),
    path('<int:id>/update/', views.update, name='update'),
    path('<int:id>/delete/', views.delete, name='delete'),
    path('<int:post_id>/comments/create/', views.comment_create, name='comment_create'),
    path('<int:post_id>/comments/<int:comment_id>/delete/', views.comment_delete, name='comment_delete'),
    path('<int:post_id>/like/', views.like, name='like'),
]
>>>>>>> 0fc38c738e3dab5016788bbea9138ef1876252bb
