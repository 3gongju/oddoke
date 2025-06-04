"""
ASGI config for oddoke project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
import ddokchat.routing


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'oddoke.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),  # 일반 요청은 그대로 처리
    "websocket": AuthMiddlewareStack(  # WebSocket은 따로 처리
        URLRouter(
            ddokchat.routing.websocket_urlpatterns  # 웹소켓 연결 주소들 모음
        )
    ),
})