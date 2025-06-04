from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/chat/(?P<room_id>\d+)/$', consumers.ChatConsumer.as_asgi()),
]

# 주소 형식이 들어오면 chatconsumer가 연결돼서 실시간 채팅을 관리해줌