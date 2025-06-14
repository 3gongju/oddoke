from django.contrib.auth.decorators import user_passes_test
from django.shortcuts import redirect
from django.contrib import messages
from functools import wraps
import logging

logger = logging.getLogger(__name__)


def oddmin_required(view_func):
    """
    어덕해 관리자 권한이 필요한 뷰에 사용하는 데코레이터
    staff 또는 superuser만 접근 가능
    """
    def check_oddmin_permission(user):
        return user.is_authenticated and (user.is_staff or user.is_superuser)
    
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.error(request, '로그인이 필요합니다.')
            logger.warning(f"Unauthenticated access attempt to {view_func.__name__}")
            return redirect('accounts:login')
        
        if not (request.user.is_staff or request.user.is_superuser):
            messages.error(request, '관리자 권한이 필요합니다.')
            logger.warning(f"Unauthorized access attempt by {request.user.username} to {view_func.__name__}")
            return redirect('/')
        
        logger.info(f"Admin access granted to {request.user.username} for {view_func.__name__}")
        return view_func(request, *args, **kwargs)
    
    return wrapper


def cafe_admin_required(view_func):
    """
    생일카페 관리 권한 (향후 세분화된 권한 시스템 확장용)
    현재는 oddmin_required와 동일하지만, 향후 카페 전담 관리자 등을 위해 분리
    """
    return oddmin_required(view_func)


def fandom_admin_required(view_func):
    """
    팬덤 인증 관리 권한 (향후 세분화된 권한 시스템 확장용)
    현재는 oddmin_required와 동일하지만, 향후 팬덤 전담 관리자 등을 위해 분리
    """
    return oddmin_required(view_func)


def superuser_required(view_func):
    """
    슈퍼유저만 접근 가능한 뷰 (시스템 설정, 사용자 관리 등)
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.error(request, '로그인이 필요합니다.')
            return redirect('accounts:login')
        
        if not request.user.is_superuser:
            messages.error(request, '최고 관리자 권한이 필요합니다.')
            logger.warning(f"Superuser access attempt by {request.user.username} to {view_func.__name__}")
            return redirect('oddmin:dashboard')
        
        return view_func(request, *args, **kwargs)
    
    return wrapper