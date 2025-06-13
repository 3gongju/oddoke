from django.urls import path, include
from . import views

app_name = 'accounts'

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),

    # 이메일 유효성 검사
    path('activate/<uidb64>/<token>/', views.activate, name='activate'),
    
    # 카카오 로그인 추가
    path('kakao/login/', views.kakao_login, name='kakao_login'),
    path('kakao/callback/', views.kakao_callback, name='kakao_callback'),
    
    # 네이버 로그인 추가
    path('naver/login/', views.naver_login, name='naver_login'),
    path('naver/callback/', views.naver_callback, name='naver_callback'),
    path('naver/logout/', views.naver_logout, name='naver_logout'),  # 선택사항

    # 소셜 로그인 추가 정보 입력
    path('social/complete/', views.social_signup_complete, name='social_signup_complete'),

    # mypage
    path('my/', views.mypage, name='mypage'),
    
    # 설정 페이지들 (기존 edit_profile을 설정 메인으로 사용)
    path('<str:username>/settings/', views.settings_main, name='settings_main'),  # 설정 메인 페이지
    path('<str:username>/edit/profile/', views.edit_profile_info, name='edit_profile_info'),  # 회원정보 수정
    path('<str:username>/edit/image/', views.edit_profile_image, name='edit_profile_image'),
    path('<str:username>/edit/fandom/', views.fandom_verification, name='fandom_verification'),  # 팬덤 인증
    path('<str:username>/edit/account/', views.account_settings, name='account_settings'),  # 계좌 설정
    path('<str:username>/edit/address/', views.address_settings, name='address_settings'),  # 주소 설정
    path('<str:username>/edit/info/', views.account_info, name='account_info'),  # 계정 정보
    
    # 기존 팬덤 인증 (호환성 유지)
    path('<str:username>/fandom-auth/', views.upload_fandom_card, name='upload_fandom_card'),

    # profile
    path('profile/<username>/', views.profile, name='profile'),

    # follow
    path('<username>/follow/', views.follow, name='follow'),
    path('<str:username>/follow-list/', views.follow_list, name='follow_list'),

    # 리뷰 페이지
    path('<username>/reviews/', views.review_home, name='review_home'), 

    # 계좌
    path('<str:username>/account/', views.account_registration, name='account_registration'),
    path('<str:username>/account/modify/', views.account_modify, name='account_modify'),
    path('<str:username>/account/delete/', views.account_delete, name='account_delete'),

    # 주소
    path('<str:username>/address/', views.address_registration, name='address_registration'),
    path('<str:username>/address/modify/', views.address_modify, name='address_modify'),
    path('<str:username>/address/delete/', views.address_delete, name='address_delete'),
]