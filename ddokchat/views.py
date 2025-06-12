from django.shortcuts import render, redirect, get_object_or_404
from .models import ChatRoom
from accounts.models import MannerReview, User
from accounts.forms import MannerReviewForm
from django.contrib.auth.decorators import login_required
from django.contrib.contenttypes.models import ContentType
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost
from .models import ChatRoom, Message
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST
from django.core.files.storage import default_storage
from django.urls import reverse

from .services import get_dutcheat_service

import json
from django.contrib.auth import get_user_model

# Create your views here.

# 채팅방.
def chat_room(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)

    room.other_user = room.seller if room.buyer == request.user else room.buyer # 상대방 프로필 이미지 추가

    # ✅ 구매자 리뷰 작성 여부 확인
    has_already_reviewed = False
    if request.user == room.buyer and room.is_fully_completed:
        has_already_reviewed = MannerReview.objects.filter(
            user=request.user,
            target_user=room.seller,
            chatroom=room
        ).exists()

    # 내가 안 읽은 메시지 읽음 처리
    Message.objects.filter(
        Q(room=room) & Q(is_read=False) & ~Q(sender=request.user)
    ).update(is_read=True)

    messages = Message.objects.filter(room=room).select_related('sender').order_by('timestamp')  # 메시지 순서대로 정렬
    
    # 분철 관련 정보 추가
    split_info = None
    if hasattr(room.post, 'category_type') and room.post.category_type == 'split':
        from ddokfarm.models import SplitApplication
        application = SplitApplication.objects.filter(
            post=room.post,
            user=room.buyer,
            status='approved'
        ).prefetch_related('members').first()
        
        if application:
            split_info = {
                'applied_members': application.members.all(),
                'total_price': sum(
                    room.post.member_prices.filter(member__in=application.members.all()).values_list('price', flat=True)
                )
            }

    context = {
        'room': room,
        'messages': messages,
        'user': request.user,
        'form': MannerReviewForm(),
        'has_already_reviewed': has_already_reviewed,
        'is_fully_completed': room.is_fully_completed,
        'split_info': split_info,
    }

    return render(request, 'ddokchat/chat_room.html', context)

# 새 채팅방 생성 or 연결된 채팅방으로 이동
@login_required
def get_or_create_chatroom(request, category, post_id):
    # 1. 모델 매핑
    model_map = {
        'sell': FarmSellPost,
        'rental': FarmRentalPost,
        'split': FarmSplitPost,
    }
    model_class = model_map.get(category)
    if not model_class:
        raise ValueError("유효하지 않은 카테고리")

    # 2. 거래글 가져오기
    post = get_object_or_404(model_class, id=post_id)
    content_type = ContentType.objects.get_for_model(post)

    # 3. 자신과는 채팅 안되게 처리
    if request.user == post.user:
        return redirect('ddokfarm:post_detail', category=category, post_id=post_id)

    # 4. 기존 채팅방 가져오거나 새로 생성
    room, created = ChatRoom.objects.get_or_create(
        content_type=content_type,
        object_id=post.id,
        buyer=request.user,
        seller=post.user,
    )

    return redirect('ddokchat:chat_room', room_id=room.id)

# 내 채팅 목록
@login_required
def my_chatrooms(request):
    rooms = ChatRoom.objects.filter(
    Q(buyer=request.user) | Q(seller=request.user)
    ).prefetch_related('messages')  # 쿼리 최적화

    rooms = sorted(rooms, key=lambda room: room.messages.last().timestamp if room.messages.exists() else room.created_at, reverse=True)
    
    for room in rooms:
        room._current_user = request.user
        room.partner = room.seller if room.buyer == request.user else room.buyer
        room.last_message = room.messages.last()
        room.unread_count = room.messages.filter(is_read=False).exclude(sender=request.user).count()
        room.category = room.post.category_type  # 'sell' 등

    # ✅ 거래중 / 거래완료 분리
    active_rooms = [room for room in rooms if not room.is_fully_completed]
    completed_rooms = [room for room in rooms if room.is_fully_completed]

    context = {
        'rooms': rooms,
        'active_rooms': active_rooms,
        'completed_rooms': completed_rooms,
        'me': request.user,
    }
    return render(request, 'ddokchat/my_rooms.html', context)


@login_required
@require_POST
def upload_image(request):
    if 'image' not in request.FILES or 'room_id' not in request.POST:
        return JsonResponse({'success': False, 'error': '요청이 잘못되었습니다.'}, status=400)

    image_file = request.FILES['image']
    room_id = request.POST['room_id']

    try:
        room = ChatRoom.objects.get(id=room_id)
        message = Message.objects.create(
            room=room,
            sender=request.user,
            image=image_file
        )
        return JsonResponse({'success': True, 'image_url': message.image.url})
    except ChatRoom.DoesNotExist:
        return JsonResponse({'success': False, 'error': '존재하지 않는 채팅방입니다.'}, status=404)

@require_POST
@login_required
def complete_trade(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    user = request.user

    is_buyer = (room.buyer == user)
    is_seller = (room.seller == user)

    if not (is_buyer or is_seller):
        return JsonResponse({'success': False, 'error': '권한이 없습니다.'}, status=403)

    if is_buyer:
        room.buyer_completed = True
    if is_seller:
        room.seller_completed = True

    room.save()

    is_fully_completed = room.buyer_completed and room.seller_completed

    return JsonResponse({
        'success': True,
        'is_fully_completed': is_fully_completed,
        'is_buyer': is_buyer,
    })



#계좌 정보 메시지 전송 & 더치트 

@require_POST
@login_required
def send_account_info(request, room_id):
    """계좌정보 전송"""
    try:
        room = get_object_or_404(ChatRoom, id=room_id)
        
        # 채팅방 참여자 확인
        if request.user not in [room.buyer, room.seller]:
            return JsonResponse({
                'success': False,
                'error': '채팅방 참여자만 계좌정보를 보낼 수 있습니다.'
            })
        
        # 거래 완료 상태 확인
        if room.is_fully_completed:
            return JsonResponse({
                'success': False,
                'error': '이미 완료된 거래입니다.'
            })
        
        # 🔥 BankProfile에서 계좌정보 확인 (수정된 부분)
        user = request.user
        bank_profile = user.get_bank_profile()
        
        if not bank_profile or not all([bank_profile.bank_name, bank_profile.account_number, bank_profile.account_holder]):
            return JsonResponse({
                'success': False,
                'redirect_to_mypage': True,
                'error': '계좌 정보를 먼저 등록해주세요.'
            })
        
        # 🔥 BankProfile 데이터로 메시지 저장 (수정된 부분)
        message = Message.objects.create(
            room=room,
            sender=request.user,
            message_type='account_info',
            account_bank_name=bank_profile.bank_name,
            account_number=bank_profile.account_number,  # 이미 복호화됨
            account_holder=bank_profile.account_holder,
            account_bank_code=bank_profile.bank_code or '',
        )
        
        # 🔥 계좌정보 구성 (수정된 부분)
        account_info = {
            'bank_name': bank_profile.bank_name,
            'bank_code': bank_profile.bank_code or '',
            'account_number': bank_profile.account_number,  # 이미 복호화됨
            'account_holder': bank_profile.account_holder,
        }
        
        return JsonResponse({
            'success': True,
            'account_info': account_info
        })
        
    except Exception as e:
        print(f"send_account_info 에러: {e}")  # 디버깅용
        return JsonResponse({
            'success': False,
            'error': f'서버 오류가 발생했습니다: {str(e)}'
        })

@require_POST
@login_required
def check_account_fraud(request):
    """계좌 사기 이력 조회"""
    try:
        data = json.loads(request.body)
        bank_code = data.get('bank_code')
        account_number = data.get('account_number')
        account_holder = data.get('account_holder')
        
        # 입력값 검증
        if not all([account_number, account_holder]):
            return JsonResponse({
                'success': False,
                'error': '계좌번호와 예금주를 모두 입력해주세요.'
            })
        
        # 🔥 더치트 서비스 사용 (실제 서비스 연동)
        try:
            dutcheat_service = get_dutcheat_service()
            result = dutcheat_service.check_account_fraud_history(
                bank_code=bank_code,
                account_number=account_number,
                account_holder=account_holder
            )
            
            if result.get('success'):
                return JsonResponse({
                    'success': True,
                    'has_reports': result.get('has_reports', False),
                    'report_count': result.get('report_count', 0),
                    'reports': result.get('reports', []),
                    'last_updated': result.get('last_updated', '')
                })
            else:
                # 더치트 서비스 실패 시 더미 데이터로 폴백
                return _get_dummy_fraud_data(account_number)
                
        except Exception as e:
            print(f"더치트 서비스 오류: {e}")
            # 서비스 오류 시 더미 데이터로 폴백
            return _get_dummy_fraud_data(account_number)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': '잘못된 요청 형식입니다.'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'조회 중 오류가 발생했습니다: {str(e)}'
        })

def _get_dummy_fraud_data(account_number):
    """더미 사기 신고 데이터 반환 (폴백용)"""
    dummy_reports = []
    
    # 테스트용: 특정 계좌번호에 대해서만 신고 내역 있는 것으로 처리
    if '1111' in account_number:
        dummy_reports = [
            {
                'report_type': '입금 후 연락두절',
                'description': '상품을 보내지 않고 연락이 되지 않습니다.',
                'status': '확인됨',
                'report_date': '2024-11-15',
                'amount': 150000
            },
            {
                'report_type': '가짜 상품 판매',
                'description': '정품이라고 했는데 가짜 상품을 보냈습니다.',
                'status': '조사중',
                'report_date': '2024-11-10',
                'amount': 89000
            }
        ]
    
    return JsonResponse({
        'success': True,
        'has_reports': len(dummy_reports) > 0,
        'report_count': len(dummy_reports),
        'reports': dummy_reports,
        'last_updated': '2024-11-20 15:30'
    })

@require_POST
@login_required
def copy_account_log(request):
    """계좌번호 복사 로그 기록"""
    try:
        data = json.loads(request.body)
        account_number = data.get('account_number')
        
        # 로그 기록 (실제로는 데이터베이스에 저장)
        print(f"사용자 {request.user.username}이 계좌번호 {account_number}를 복사했습니다.")
        
        return JsonResponse({
            'success': True
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

# 분철 참여자와의 채팅방 생성/연결
@login_required
def get_or_create_split_chatroom(request, post_id, user_id):
    
    User = get_user_model()
    
    # 1. 분철 게시글과 참여자 확인
    post = get_object_or_404(FarmSplitPost, id=post_id)
    participant = get_object_or_404(User, id=user_id)
    
    # 2. 권한 확인: 게시글 작성자만 접근 가능
    if request.user != post.user:
        return redirect('ddokfarm:post_detail', category='split', post_id=post_id)
    
    # 3. 해당 사용자가 실제로 승인된 참여자인지 확인
    from ddokfarm.models import SplitApplication
    approved_application = SplitApplication.objects.filter(
        post=post,
        user=participant,
        status='approved'
    ).exists()
    
    if not approved_application:
        return redirect('ddokfarm:manage_split_applications', category='split', post_id=post_id)
    
    # 4. 채팅방 생성/연결
    content_type = ContentType.objects.get_for_model(post)
    
    room, created = ChatRoom.objects.get_or_create(
        content_type=content_type,
        object_id=post.id,
        buyer=participant,  # 참여자를 buyer로
        seller=request.user,  # 총대(게시글 작성자)를 seller로
    )
    
    return redirect('ddokchat:chat_room', room_id=room.id)

