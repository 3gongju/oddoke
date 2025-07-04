from django.urls import path, include
from . import views
from django.contrib.auth import views as auth_views

app_name = 'accounts'

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),

    # 이메일 유효성 검사
    path('activate/<uidb64>/<token>/', views.activate, name='activate'),
    
    # 카카오 로그인
    path('kakao/login/', views.kakao_login, name='kakao_login'),
    path('kakao/callback/', views.kakao_callback, name='kakao_callback'),
    path('kakao/logout/', views.kakao_logout, name='kakao_logout'),
    
    # 네이버 로그인
    path('naver/login/', views.naver_login, name='naver_login'),
    path('naver/callback/', views.naver_callback, name='naver_callback'),
    path('naver/logout/', views.naver_logout, name='naver_logout'),
    
    # 구글 로그인
    path('google/login/', views.google_login, name='google_login'),
    path('google/callback/', views.google_callback, name='google_callback'),
    path('google/logout/', views.google_logout, name='google_logout'),

    # 소셜 로그인 추가 정보 입력
    path('social/complete/', views.social_signup_complete, name='social_signup_complete'),
    
    # 비밀번호 재설정 
    path('password-reset/', views.CustomPasswordResetView.as_view(), name='password_reset'),
    path('password-reset/sent/', views.CustomPasswordResetDoneView.as_view(), name='password_reset_done'),
    path('password-reset/confirm/<uidb64>/<token>/', views.CustomPasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('password-reset/complete/', views.CustomPasswordResetCompleteView.as_view(), name='password_reset_complete'),

    # ===== 개인 전용 페이지 (my/로 통일) =====
    # mypage
    path('my/', views.mypage, name='mypage'),
    
    # 설정 페이지들
    path('my/settings/', views.settings_main, name='settings_main'),
    path('my/edit/profile/', views.edit_profile_info, name='edit_profile_info'),
    path('my/edit/image/', views.edit_profile_image, name='edit_profile_image'),
    path('my/edit/fandom/', views.fandom_verification, name='fandom_verification'),
    path('my/edit/bank/', views.bank_settings, name='bank_settings'),
    path('my/edit/address/', views.address_settings, name='address_settings'),
    path('my/edit/info/', views.account_info, name='account_info'),
    
    # 기존 팬덤 인증
    path('my/fandom-auth/', views.upload_fandom_card, name='upload_fandom_card'),

    # 계좌 관련
    path('my/bank/register/', views.bank_registration, name='bank_registration'),
    path('my/bank/modify/', views.bank_modify, name='bank_modify'),
    path('my/bank/delete/', views.bank_delete, name='bank_delete'),

    # 주소 관련
    path('my/address/register/', views.address_registration, name='address_registration'),
    path('my/address/modify/', views.address_modify, name='address_modify'),
    path('my/address/delete/', views.address_delete, name='address_delete'),

    # ===== 공개 페이지 =====
    # profile
    path('profile/<username>/', views.profile, name='profile'),

    # follow
    path('<username>/follow/', views.follow, name='follow'),
    path('<str:username>/follow-list/', views.follow_list, name='follow_list'),

    # 리뷰 페이지
    path('<username>/reviews/', views.review_home, name='review_home'), 
    path('<username>/review/create/', views.review_create, name='review_create'),

    # ===== 공통 기능들 =====
    # 공통 신고 기능 URL 추가
    path('report/<str:app_name>/<str:category>/<int:post_id>/', views.report_post, name='report_post'),
    path('report/<str:app_name>/<str:category>/<int:post_id>/form/', views.get_report_form, name='get_report_form'),

    # 배너 신청 관련
    path('banner-request/', views.submit_banner_request, name='submit_banner_request'),
    path('banner-request/form/', views.banner_request_form, name='banner_request_form'), 

    path('report/user/<int:user_id>/', views.report_user, name='report_user'),
]