from django.urls import path
from . import views

app_name = 'ddokchat'

urlpatterns = [
    # 채팅방으로 이동
    path('room/<int:room_id>/', views.chat_room, name='chat_room'),

    # 채팅방 생성 or 찾아서 연결
    path('start/<str:category>/<int:post_id>/', views.get_or_create_chatroom, name='start_chat'),

    # 채팅방 이미지 첨부
    path('upload_image/', views.upload_image, name='upload_image'),

    # 채팅방 거래 완료
    path('complete/<int:room_id>/', views.complete_trade, name='complete_trade'),

    # 내 채팅방 목록
    path('my/', views.my_chatrooms, name='my_chatrooms'),

    # 계좌정보 확인 /더치트 사기조회
    # path('send-account/<int:room_id>/', views.send_account_info, name='send_account_info'),
    # path('check-fraud/', views.check_account_fraud, name='check_account_fraud'),
    # path('copy-account/', views.copy_account_log, name='copy_account_log'),

    # 분철 참여자와의 채팅
    path('start-split/<int:post_id>/<int:user_id>/', views.get_or_create_split_chatroom, name='start_split_chat'),

]