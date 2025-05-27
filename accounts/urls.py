from django.urls import path, include
from . import views



app_name = 'accounts'

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    
    
    # 카카오 로그인 추가
    path('kakao/login/', views.kakao_login, name='kakao_login'),
    path('kakao/callback/', views.kakao_callback, name='kakao_callback'),
    
    # 네이버 로그인 추가
    path('naver/login/', views.naver_login, name='naver_login'),
    path('naver/callback/', views.naver_callback, name='naver_callback'),
    path('naver/logout/', views.naver_logout, name='naver_logout'),  # 선택사항


    # mypage
    path('my/', views.mypage, name='mypage'),
    # my -> 프로필 관리
    path('<str:username>/edit/', views.edit_profile, name='edit_profile'),
    path('<str:username>/edit/image/', views.edit_profile_image, name='edit_profile_image'),

    # profile
    path('profile/<username>/', views.profile, name='profile'),

    # follow
    path('<username>/follow/', views.follow, name='follow'),
    path('<str:username>/follow-list/', views.follow_list, name='follow_list'),
    # 리뷰 페이지
    path('<username>/reviews/', views.review_home, name='review_home'),
 
    
   
]