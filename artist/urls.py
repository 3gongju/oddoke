from django.urls import path
from . import views

app_name = 'artist'

urlpatterns = [
    path('', views.index, name='index'),
    path('<int:artist_id>/toggle/', views.toggle_favourite, name='toggle_favourite'),
    path('autocomplete/', views.autocomplete, name='autocomplete'),
]