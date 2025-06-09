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

    # 게시글 수정
    path('<str:category>/<int:post_id>/edit/', views.post_edit, name='post_edit'),

    # 게시글 삭제
    path('<str:category>/<int:post_id>/delete/', views.post_delete, name='post_delete'),

    # 댓글 작성
    path('<str:category>/<int:post_id>/comments/create/', views.comment_create, name='comment_create'),

    # 댓글 삭제
    path('<str:category>/<int:post_id>/comments/<int:comment_id>/delete/', views.comment_delete, name='comment_delete'),

    # 좋아요(찜하기)
    path('<str:category>/<int:post_id>/like/', views.like_post, name='like_post'),

    # 판매 완료 표시
    path('<str:category>/<int:post_id>/mark-as-sold/', views.mark_as_sold, name='mark_as_sold'),

    # 멤버 목록 불러오기
    path('ajax/artist/<int:artist_id>/members/', views.get_members_by_artist, name='get_members_by_artist'),

    # 아티스트 검색
    path('ajax/search_artists/', views.search_artists, name='search_artists'),

    # 분철 폼셋
    path('ajax/load_split_members_and_prices/', views.load_split_members_and_prices, name='load_split_members_and_prices'),

    # 판매
    path('sell/', views.sell_index, name='sell_index'),

    # 대여
    path('rental/', views.rental_index, name='rental_index'),

    # 분철
    path('split/', views.split_index, name='split_index'),
]
