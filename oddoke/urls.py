from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from oddoke import views  # oddoke/views.py

urlpatterns = [
    path('admin/', admin.site.urls),                   # 관리자 페이지
    
    path('', views.main, name='home'),                 # 메인 페이지 (home.html)
    path('artist/', include('artist.urls')),           # 아티스트 관련 (찜, 목록 등)
    path('ddokfarm/', include('ddokfarm.urls')),       # 중고 굿즈 거래 기능
    path('ddokdam/', include('ddokdam.urls')),         # 덕질 공유 & 예절샷
    path('accounts/', include('accounts.urls')),      # 로그인/회원가입 등
    path('calendar/', include('bday_calendar.urls', namespace='bday_calendar')), # 생일 달력
    path('ddoksang/', include('ddoksang.urls')),       # 생일 카페, 투어 플랜 등
    path('ddokchat/', include('ddokchat.urls')),        # 채팅
    path('faq/', include('faq.urls')),                 # faq
    path('notifications/', include('notifications.urls')), # 알림
    
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
