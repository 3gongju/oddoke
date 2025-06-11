from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    # 알림 목록 페이지
    path('', views.notification_list, name='notification_list'),
    
    # 읽지 않은 알림 개수 (AJAX)
    path('unread-count/', views.unread_notification_count, name='unread_count'),
    
    # 알림 내용으로 이동 (읽음 처리 + 리다이렉트)
    path('<int:notification_id>/goto/', views.goto_content, name='goto_content'),
    
    # 특정 알림 읽음 처리
    path('<int:notification_id>/read/', views.mark_notification_read, name='mark_read'),
    
    # 모든 알림 읽음 처리
    path('mark-all-read/', views.mark_all_notifications_read, name='mark_all_read'),
    
    # 특정 알림 삭제
    path('<int:notification_id>/delete/', views.delete_notification, name='delete_notification'),
]