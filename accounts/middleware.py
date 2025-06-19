# accounts/middleware.py
from django.shortcuts import redirect
from django.urls import reverse
from django.contrib import messages
from django.utils import timezone


class SuspensionCheckMiddleware:
    """제재된 사용자의 활동 제한 미들웨어"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 로그인한 사용자이고 제재 중인 경우
        if (request.user.is_authenticated and 
            hasattr(request.user, 'is_suspended') and 
            request.user.is_suspended):
            
            # 제재 해제된 경우 정리
            if (request.user.suspension_end and 
                request.user.suspension_end <= timezone.now()):
                
                request.user.suspension_start = None
                request.user.suspension_end = None
                request.user.suspension_reason = None
                request.user.save(update_fields=[
                    'suspension_start', 'suspension_end', 'suspension_reason'
                ])
            else:
                # 제재 중인 사용자가 제한된 URL에 접근하려고 할 때
                restricted_patterns = [
                    '/ddokdam/create/',
                    '/ddokfarm/create/',
                    '/ddoksang/create/',
                    '/ddokdam/',
                    '/ddokfarm/',
                    '/ddoksang/',
                ]
                
                # POST 요청은 모두 차단 (댓글, 좋아요 등)
                if request.method == 'POST':
                    # AJAX 요청인 경우
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        from django.http import JsonResponse
                        return JsonResponse({
                            'success': False,
                            'error': f'이용이 제한되었습니다. {request.user.suspension_status}',
                            'suspended': True
                        })
                    
                    # 일반 POST 요청인 경우
                    messages.error(
                        request, 
                        f'이용이 제한되어 해당 작업을 수행할 수 없습니다. '
                        f'제재 상태: {request.user.suspension_status}'
                    )
                    return redirect('/')
                
                # 특정 URL 접근 제한
                for pattern in restricted_patterns:
                    if request.path.startswith(pattern):
                        messages.warning(
                            request,
                            f'이용이 제한되어 해당 페이지에 접근할 수 없습니다. '
                            f'제재 상태: {request.user.suspension_status}'
                        )
                        return redirect('/')
        
        response = self.get_response(request)
        return response