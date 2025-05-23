from django.urls import path
from . import views

app_name = 'artist'

urlpatterns = [
    path('', views.index, name='index'), #검색 + 찜 분리된 최신 index 뷰
    path('<int:artist_id>/toggle/', views.toggle_favourite, name='toggle_favourite'),
    path('autocomplete/', views.autocomplete, name='autocomplete'),
]