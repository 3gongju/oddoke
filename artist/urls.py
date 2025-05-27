from django.urls import path
from . import views

app_name = 'artist'

urlpatterns = [
    path('', views.index, name='index'), #검색 + 찜 분리된 최신 index 뷰
    path('<int:artist_id>/toggle/', views.toggle_favorite, name='toggle_favorite'),
    path('autocomplete/', views.autocomplete, name='autocomplete'),

    # 멤버 리스트 Ajax 요청
    path('<int:artist_id>/members/', views.artist_members_ajax, name='artist_members_ajax'),

    # 멤버 팔로우 토글 Ajax 요청
    path('member/<int:member_id>/follow-toggle/', views.follow_member_ajax, name='follow_member_ajax'),
]