# bday_calendar/urls.py
from django.urls import path
from . import views

app_name = 'bday_calendar'

urlpatterns = [
    path('', views.birthday_calendar, name='calendar'),
    path('events/', views.birthday_events_api, name='events_api'), 
    path('events/weekly/', views.birthday_events_api, name='weekly_events_api'),  # 선택적으로 분리 가능
]