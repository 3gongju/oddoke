from django.urls import path
from . import views

app_name = 'ddokdam'

urlpatterns = [
    path('', views.index, name='index'),
    path('create/', views.post_create, name='post_create'),
    path('<str:category>/<int:post_id>/', views.post_detail, name='post_detail'),
    
    # 댓글 create
    path('<str:category>/<int:post_id>/comments/create/', views.comment_create, name='comment_create'),


    # community
    path('community/', views.community_index, name='community_index'),
    # path('community/<int:post_id>/', views.community_detail, name='community_detail'),
    # path('community/create/', views.community_create, name='community_create'),
    # path('community/<int:post_id>/update/', views.community_update, name='community_update'),
    # path('community/<int:post_id>/delete/', views.community_delete, name='community_delete'),

    # manner
    path('manner/', views.manner_index, name='manner_index'),
    # path('manner/<int:post_id>/', views.manner_detail, name='manner_detail'),
    # path('manner/create/', views.manner_create, name='manner_create'),
    # path('manner/<int:post_id>/update/', views.manner_update, name='manner_update'),
    # path('manner/<int:post_id>/delete/', views.manner_delete, name='manner_delete'),

    # bdaycafe
    path('bdaycafe/', views.bdaycafe_index, name='bdaycafe_index'),
    # path('bdaycafe/<int:post_id>/', views.bdaycafe_detail, name='bdaycafe_detail'),
    # path('bdaycafe/create/', views.bdaycafe_create, name='bdaycafe_create'),
    # path('bdaycafe/<int:post_id>/update/', views.bdaycafe_update, name='bdaycafe_update'),
    # path('bdaycafe/<int:post_id>/delete/', views.bdaycafe_delete, name='bdaycafe_delete'),

    # path('<int:post_id>/comments/<int:comment_id>/delete/', views.comment_delete, name='comment_delete'),
    # path('<int:post_id>/like/', views.like, name='like'),
    # path('update/<int:post_id>/', views.update, name='update'),
    # path('<int:post_id>/', views.detail, name='detail'), 
]
