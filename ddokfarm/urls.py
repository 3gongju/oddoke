from django.urls import path
from . import views

app_name = 'ddokfarm'

urlpatterns = [path('create/', views.create, name='create')]