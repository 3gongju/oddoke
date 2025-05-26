from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),

    # mypage
    path('my/', views.mypage, name='mypage'),

    # profile
    path('profile/<username>/', views.profile, name='profile'),

    # follow
    path('<username>/follow/', views.follow, name='follow'),
    path('<str:username>/follow-list/', views.follow_list, name='follow_list'),
    # 리뷰 페이지
    path('<username>/reviews/', views.review_home, name='review_home'),
]