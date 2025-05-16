from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),

    # profile
    path('<username>/', views.profile, name='profile'),
    # follow
    path('<username>/follow/', views.follow, name='follow'),
]