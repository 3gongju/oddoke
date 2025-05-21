from django.urls import path
from . import views

app_name = 'artist'

urlpatterns = [
    path('', views.index, name='index'),
]