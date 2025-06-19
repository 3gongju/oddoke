# accounts/middleware.py
from django.shortcuts import redirect
from django.urls import reverse
from django.contrib import messages
from django.utils import timezone
from django.http import JsonResponse


class SuspensionCheckMiddleware:
    """제재된 사용자의 활동 제한 미들웨어"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 🔥 디버깅: 미들웨어 실행 확인
        print(f"=== 미들웨어 실행: {request.path} ===")
        
        # 로그인한 사용자이고 제재 중인 경우
        if request.user.is_authenticated:
            print(f"사용자: {request.user.username}")
            
            if hasattr(request.user, 'is_suspended'):
                print(f"is_suspended 속성 존재: {request.user.is_suspended}")
                
                try:
                    # 제재 해제된 경우 정리
                    if (hasattr(request.user, 'suspension_end') and
                        request.user.suspension_end and 
                        request.user.suspension_end <= timezone.now()):
                        
                        print("제재 기간 만료 - 해제 중...")
                        request.user.lift_suspension()
                    
                    elif request.user.is_suspended:
                        print(f"🚫 제재 중인 사용자 감지! 상태: {request.user.suspension_status}")
                        
                        # 🔥 제재 중인 사용자가 접근 가능한 URL만 허용 (더 구체적으로)
                        allowed_patterns = [
                            '/admin/',  # 관리자는 접근 가능
                            '/accounts/logout/',  # 로그아웃은 허용
                            '/accounts/profile/',  # 프로필 확인은 허용
                            '/static/',  # 정적 파일
                            '/media/',   # 미디어 파일
                            '/notifications/',  # 알림은 허용
                        ]
                        
                        # 정확히 메인 페이지만 허용 (하위 경로는 불허)
                        if request.path == '/':
                            is_allowed = True
                            print("메인 페이지 접근 허용")
                        else:
                            is_allowed = any(request.path.startswith(pattern) for pattern in allowed_patterns)
                        
                        print(f"허용된 URL인가? {is_allowed} (경로: {request.path})")
                        
                        if not is_allowed:
                            # POST 요청은 모두 차단
                            if request.method == 'POST':
                                print("🚫 POST 요청 차단!")
                                # AJAX 요청인 경우
                                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                                    return JsonResponse({
                                        'success': False,
                                        'error': f'이용이 제한되었습니다. {request.user.suspension_status}',
                                        'suspended': True
                                    }, status=403)
                                
                                # 일반 POST 요청인 경우 - messages 제거
                                return redirect('/')
                            
                            # GET 요청 중 게시글 작성과 상세보기만 차단
                            restricted_patterns = [
                                '/ddokdam/create/',          # 🔥 덕담 게시글 작성
                                '/ddokfarm/create/',         # 덕팜 게시글 작성
                                '/ddoksang/create/',         # 덕상 게시글 작성
                            ]
                            
                            # 🔥 게시글 상세보기 패턴 체크 (문자열 매칭)
                            path_parts = request.path.strip('/').split('/')
                            if (len(path_parts) >= 3 and 
                                path_parts[0] in ['ddokdam', 'ddokfarm', 'ddoksang'] and
                                path_parts[2].isdigit()):
                                print(f"🚫 게시글 상세보기 접근 차단: {request.path}")
                                # messages 제거 - 모달로 처리할 예정
                                print("🔄 메인 페이지로 리다이렉트 실행")
                                return redirect('/')
                            
                            # 게시글 작성 페이지 차단
                            for pattern in restricted_patterns:
                                if request.path.startswith(pattern):
                                    print(f"🚫 게시글 작성 페이지 접근 차단: {pattern}")
                                    # messages 제거 - 모달로 처리할 예정
                                    print("🔄 메인 페이지로 리다이렉트 실행")
                                    return redirect('/')
                            
                            print("목록 페이지 접근 허용 - 게시글 작성/상세보기만 차단")
                        else:
                            print(f"허용된 URL 접근: {request.path}")
                    else:
                        print("✅ 제재되지 않은 사용자")
                
                except Exception as e:
                    # 오류 발생 시 로그만 남기고 계속 진행
                    print(f"SuspensionCheckMiddleware 오류: {e}")
            else:
                print("❌ is_suspended 속성이 없음!")
        else:
            print("비로그인 사용자")
        
        response = self.get_response(request)
        return response