from django.urls import path
from . import views

app_name = 'ddokdam'

urlpatterns = [
    # 덕담 메인 페이지
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

    # 좋아요
    path('<str:category>/<int:post_id>/like/', views.like_post, name='like_post'),

    # 멤버 목록 불러오기
    path('ajax/artist/<int:artist_id>/members/', views.get_members_by_artist, name='get_members_by_artist'),

    # 아티스트 검색
    path('ajax/search_artists/', views.search_artists, name='search_artists'),
  
    # 덕생 카페 자동완성용
    path('ajax/search_ddoksang_cafes/', views.search_ddoksang_cafes, name='search_ddoksang_cafes'),
    
    # community
    path('community/', views.community_index, name='community_index'),

    # manner
    path('manner/', views.manner_index, name='manner_index'),

    # bdaycafe
    path('bdaycafe/', views.bdaycafe_index, name='bdaycafe_index'),


]
