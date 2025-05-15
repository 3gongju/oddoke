from django.urls import path
from . import views

app_name = 'ddokfarm'

urlpatterns = [
    path('', views.index, name='index'),
    path('create/', views.create, name='create'),
    path('<int:id>/', views.detail, name='detail'),

    # comment_create
    path('<int:post_id>/comments/create', views.comment_create, name='comment_create'),
]