from django.urls import path
from . import views

app_name = 'ddokfarm'

urlpatterns = [
    # 덕팜 메인 페이지
    path('', views.index, name='index'),

    # 게시글 작성
    path('create/', views.post_create, name='post_create'),

    # 게시글 상세보기
    path('<str:category>/<int:post_id>/', views.post_detail, name='post_detail'),

    # 판매
    path('sell/', views.sell_index, name='sell_index'),

    # 대여
    path('rental/', views.rental_index, name='rental_index'),

    # 분철
    path('split/', views.split_index, name='split_index'),

    # path('', views.index, name='post_index'),
    # path('create/', views.create, name='create'),
    # path('<int:post_id>/', views.detail, name='detail'),
    # path('<int:post_id>/update/', views.update, name='update'),
    # path('<int:post_id>/delete/', views.delete, name='delete'),
    # path('<int:post_id>/mark_as_sold/', views.mark_as_sold, name='mark_as_sold'),
    
    # # 찜하기 URL
    # path('<int:post_id>/like/', views.toggle_like, name='toggle_like'),

    # # 댓글 관련 URL
    # path('<int:post_id>/comments/create/', views.comment_create, name='comment_create'),
    # path('<int:post_id>/comments/<int:id>/delete/', views.comment_delete, name='comment_delete'),
]
