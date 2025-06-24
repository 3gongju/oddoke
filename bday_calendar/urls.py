# bday_calendar/urls.py
from django.urls import path
from . import views

app_name = 'bday_calendar'

urlpatterns = [
    path('', views.birthday_calendar, name='calendar'),
    path('events/', views.birthday_events_api, name='events_api'), 
    path('events/weekly/', views.birthday_events_api, name='weekly_events_api'),  # 선택적으로 분리 가능
    path('save-ddok-point/', views.save_ddok_point, name='save_ddok_point'),
    path('today-birthdays/', views.today_birthdays_api, name='today_birthdays_api'),  # 오늘 생일 API 추가
    path('api/save-birthday-ddok-points/', views.save_birthday_ddok_points, name='save_birthday_ddok_points'), # 생일시 맞추기 게임 전용 API (새로 추가)
]