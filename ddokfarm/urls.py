from django.urls import path
from . import views

app_name = 'ddokfarm'

urlpatterns = [
    path('', views.index, name='index'),
    path('create/', views.create, name='create'),
    path('<int:id>/', views.detail, name='detail'),
# update
    path('<int:id>/update/', views.update, name= 'update'),
# delete
    path('<int:id>/delete/', views.delete, name= 'delete'),


# comment_create
    path('<int:post_id>/comments/create', views.comment_create, name='comment_create'),
# comment_Delete
    path('<int:post_id>/comments/<int:id>/delete', views.comment_delete, name = 'comment_delete'),
        #post/2/comments/2/delete

]