from django.urls import path
from . import views

app_name = 'ddokchat'

urlpatterns = [
    # 채팅방으로 이동
    path('room/<str:room_code>/', views.chat_room, name='chat_room'),

    # 채팅방 생성 or 찾아서 연결
    path('start/<str:category>/<int:post_id>/', views.get_or_create_chatroom, name='start_chat'),

    # 채팅방 이미지 첨부
    path('upload_image/', views.upload_image, name='upload_image'),

    # 채팅방 거래 완료
    path('complete/<str:room_code>/', views.complete_trade, name='complete_trade'),

    # 내 채팅방 목록
    path('my/', views.my_chatrooms, name='my_chatrooms'),

    # 계좌정보 및 주소정보 전송
    path('send-account/<str:room_code>/', views.send_account_info, name='send_account_info'),
    path('send-address/<str:room_code>/', views.send_address_info, name='send_address_info'),

    # 더치트 사기조회 및 로그
    path('check-fraud/', views.check_account_fraud, name='check_account_fraud'),
    path('copy-account/', views.copy_account_log, name='copy_account_log'),

    # 분철 참여자와의 채팅
    path('start-split/<int:post_id>/<int:user_id>/', views.get_or_create_split_chatroom, name='start_split_chat'),

    path('report-trade/<str:room_code>/', views.report_trade_user, name='report_trade_user'),
    path('report-form/<str:room_code>/', views.get_trade_report_form, name='get_trade_report_form'),
    path('user-info/<str:room_code>/', views.view_user_info, name='view_user_info'),
    
    # Redis 기반 채팅방 위치 추적 API
    path('api/update-current-chatroom/', views.update_current_chatroom, name='update_current_chatroom'),
    path('api/clear-current-chatroom/', views.clear_current_chatroom, name='clear_current_chatroom'),
    path('api/current-chatroom-status/', views.get_current_chatroom_status, name='current_chatroom_status'),
    
    # 거래 취소
    path('cancel/request/<str:room_code>/', views.request_trade_cancel, name='request_trade_cancel'),
    path('cancel/respond/<str:room_code>/', views.respond_trade_cancel, name='respond_trade_cancel'),
    path('cancel/withdraw/<str:room_code>/', views.withdraw_cancel_request, name='withdraw_cancel_request'),
]