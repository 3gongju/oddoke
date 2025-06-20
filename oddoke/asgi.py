# ~/oddoke/oddoke/asgi.py - 수정된 버전

import os
import django
from django.core.asgi import get_asgi_application

# Django 설정 모듈 먼저 설정
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'oddoke.settings')

# Django 완전히 초기화
django.setup()

# Django ASGI application 생성 (Django 초기화 후)
django_asgi_app = get_asgi_application()

# ✅ Django 초기화 완료 후에 channels 관련 임포트
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

# ✅ 모든 Django 앱이 로드된 후에 routing 임포트
import ddokchat.routing

# ASGI 애플리케이션 설정
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                ddokchat.routing.websocket_urlpatterns
            )
        )
    ),
})