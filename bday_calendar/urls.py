from django.urls import path
from . import views

app_name = 'bday_calendar'

urlpatterns = [  # ← 반드시 이건 list여야 함!
    path('', views.birthday_calendar, name='calendar'),
    path('api/', views.birthday_events_api, name='events_api'),
]