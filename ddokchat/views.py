from django.shortcuts import render, redirect, get_object_or_404
from .models import ChatRoom, Message, TextMessage, ImageMessage, AccountInfoMessage, AddressMessage
from accounts.models import MannerReview, User
from accounts.forms import MannerReviewForm
from django.contrib.auth.decorators import login_required
from django.contrib.contenttypes.models import ContentType
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost
from django.db.models import Q, Max, Count, Prefetch, Case, When, OuterRef, Subquery
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST
from django.core.files.storage import default_storage
from django.urls import reverse
from django.db import transaction

from .services import get_dutcheat_service

import json
from django.contrib.auth import get_user_model

# Create your views here.

# 채팅방
@login_required 
def chat_room(request, room_id):
    # N+1 해결: 관련 데이터 한번에 로드
    room = get_object_or_404(
        ChatRoom.objects.select_related(
            'buyer', 'seller',
        ),
        id=room_id
    )

    current_user = request.user
    other_user = room.seller if room.buyer == current_user else room.buyer
    room.other_user = other_user

    # 리뷰 여부 확인 최적화
    has_already_reviewed = False
    if current_user == room.buyer and room.is_fully_completed:
        has_already_reviewed = MannerReview.objects.filter(
            user=current_user,
            target_user=room.seller,
            chatroom=room
        ).exists()

    # 읽음 처리 (bulk update)
    unread_messages = Message.objects.filter(
        room=room,
        receiver=current_user,
        is_read=False
    )
    unread_count = unread_messages.update(is_read=True)

    # 메시지 조회 최적화
    messages = Message.objects.filter(room=room).select_related(
        'sender', 'receiver'
    ).prefetch_related(
        'text_content',
        'image_content',
        'account_content__bank_profile',
        'address_content__address_profile'
    ).order_by('timestamp')
    
    # 분철 관련 정보 추가 (기존 코드 유지)
    split_info = None
    if hasattr(room.post, 'category_type') and room.post.category_type == 'split':
        from ddokfarm.models import SplitApplication
        # N+1 최적화: prefetch_related 사용
        application = SplitApplication.objects.filter(
            post=room.post,
            user=room.buyer,
            status='approved'
        ).prefetch_related(
            'members',
            'post__member_prices__member'  # member_prices 관련 데이터도 미리 로드
        ).first()
        
        if application:
            split_info = {
                'applied_members': application.members.all(),
                'total_price': sum(
                    room.post.member_prices.filter(
                        member__in=application.members.all()
                    ).values_list('price', flat=True)
                )
            }

    context = {
        'room': room,
        'messages': messages,
        'current_user': current_user,
        'other_user': other_user,
        'form': MannerReviewForm(),
        'has_already_reviewed': has_already_reviewed,
        'is_fully_completed': room.is_fully_completed,
        'split_info': split_info,  # split 정보 추가
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

# 내 채팅 목록 (성능 최적화)
@login_required
def my_chatrooms(request):
    current_user = request.user
    
    # N+1 해결: 모든 데이터를 한 번의 쿼리로 가져오기
    rooms = ChatRoom.objects.filter(
        Q(buyer=current_user) | Q(seller=current_user)
    ).select_related(
        # 관련 사용자 정보 미리 로드
        'buyer', 'seller',
    ).prefetch_related(
        # 마지막 메시지만 효율적으로 가져오기
        Prefetch(
            'messages',
            queryset=Message.objects.select_related('sender', 'receiver')
                                   .prefetch_related('text_content')
                                   .order_by('-timestamp')[:1],
            to_attr='latest_messages'
        )
    ).annotate(
        # 안읽은 메시지 수를 서브쿼리로 한번에 계산
        unread_count=Count(
            'messages',
            filter=Q(
                messages__receiver=current_user,
                messages__is_read=False
            )
        ),
        # 마지막 메시지 시간
        last_message_time=Max('messages__timestamp'),
        
        # 상대방 정보를 Case/When으로 한번에 결정
        partner_id=Case(
            When(buyer=current_user, then='seller_id'),
            default='buyer_id'
        ),
        partner_username=Case(
            When(buyer=current_user, then='seller__username'),
            default='buyer__username'
        )
    ).order_by('-last_message_time')
    
    # 한번에 가져온 데이터로 추가 처리
    for room in rooms:
        # 이미 annotate로 계산된 값 사용
        room.partner = room.seller if room.buyer == current_user else room.buyer
        room.last_message = room.latest_messages[0] if room.latest_messages else None
        room.category = room.post.category_type if hasattr(room.post, 'category_type') else 'unknown'
    
    # 거래중/완료 분리
    active_rooms = [room for room in rooms if not room.is_fully_completed]
    completed_rooms = [room for room in rooms if room.is_fully_completed]

    context = {
        'rooms': rooms,
        'active_rooms': active_rooms,
        'completed_rooms': completed_rooms,
        'me': current_user,
    }
    return render(request, 'ddokchat/my_rooms.html', context)

# ✅ 수정된 이미지 업로드 함수 (receiver 설정 추가)
@login_required
@require_POST
def upload_image(request):
    if 'image' not in request.FILES or 'room_id' not in request.POST:
        return JsonResponse({'success': False, 'error': '요청이 잘못되었습니다.'}, status=400)

    image_file = request.FILES['image']
    room_id = request.POST['room_id']
    caption = request.POST.get('caption', '')  # 이미지 설명 (선택사항)

    try:
        room = ChatRoom.objects.get(id=room_id)
        sender = request.user
        receiver = room.seller if sender == room.buyer else room.buyer  # ✅ receiver 설정 추가
        
        # 거래 완료 상태 확인
        if room.is_fully_completed:
            return JsonResponse({'success': False, 'error': '이미 완료된 거래입니다.'}, status=400)
        
        # 트랜잭션으로 메시지와 이미지 정보를 함께 생성
        with transaction.atomic():
            message = Message.objects.create(
                room=room,
                sender=sender,
                receiver=receiver,  # ✅ receiver 추가
                message_type='image'
            )
            
            image_message = ImageMessage.objects.create(
                message=message,
                image=image_file,
                caption=caption
            )
        
        return JsonResponse({
            'success': True, 
            'image_url': image_message.image.url,
            'message_id': message.id
        })
    except ChatRoom.DoesNotExist:
        return JsonResponse({'success': False, 'error': '존재하지 않는 채팅방입니다.'}, status=404)
    except Exception as e:
        print(f"이미지 업로드 에러: {e}")
        return JsonResponse({'success': False, 'error': '이미지 업로드 중 오류가 발생했습니다.'}, status=500)

@require_POST
@login_required
def complete_trade(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    current_user = request.user

    is_buyer = (room.buyer == current_user)
    is_seller = (room.seller == current_user)

    if not (is_buyer or is_seller):
        return JsonResponse({'success': False, 'error': '권한이 없습니다.'}, status=403)

    if is_buyer:
        room.buyer_completed = True
    if is_seller:
        room.seller_completed = True

    room.save()

    is_fully_completed = room.buyer_completed and room.seller_completed

    # 거래가 완전히 완료되었을 때 민감한 정보 삭제 처리
    if is_fully_completed:
        delete_sensitive_info(room)
        
        # WebSocket으로 거래 완료 알림 전송
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{room.id}",
            {
                "type": "trade_completed_notification",
                "room_id": room.id,
            }
        )

    return JsonResponse({
        'success': True,
        'is_fully_completed': is_fully_completed,
        'is_buyer': is_buyer,
    })

def delete_sensitive_info(room):
    """거래 완료 시 민감한 정보 삭제 처리"""
    from django.utils import timezone
    
    now = timezone.now()
    
    # 계좌 정보 삭제 처리
    AccountInfoMessage.objects.filter(
        message__room=room,
        is_deleted=False
    ).update(
        is_deleted=True,
        deleted_at=now
    )
    
    # 주소 정보 삭제 처리
    AddressMessage.objects.filter(
        message__room=room,
        is_deleted=False
    ).update(
        is_deleted=True,
        deleted_at=now
    )

# ✅ 수정된 계좌 정보 메시지 전송 함수 (읽음 처리 개선)
@require_POST
@login_required
def send_account_info(request, room_id):
    """계좌정보 전송"""
    try:
        room = get_object_or_404(ChatRoom, id=room_id)
        sender = request.user
        
        # 채팅방 참여자 확인
        if sender not in [room.buyer, room.seller]:
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
        
        # receiver 계산
        receiver = room.seller if sender == room.buyer else room.buyer
        
        # BankProfile에서 계좌정보 확인
        bank_profile = sender.get_bank_profile()
        
        if not bank_profile or not all([bank_profile.bank_name, bank_profile.account_number, bank_profile.account_holder]):
            return JsonResponse({
                'success': False,
                'redirect_to_mypage': True,
                'error': '계좌 정보를 먼저 등록해주세요.'
            })
        
        # 트랜잭션으로 메시지와 계좌 정보를 함께 생성
        with transaction.atomic():
            message = Message.objects.create(
                room=room,
                sender=sender,
                receiver=receiver,  # ✅ receiver 설정
                message_type='account_info'
            )
            
            AccountInfoMessage.objects.create(
                message=message,
                bank_profile=bank_profile,
            )
        
        # 클라이언트로 전송할 계좌정보
        account_info = {
            'bank_name': bank_profile.bank_name,
            'bank_code': bank_profile.bank_code or '',
            'account_number': bank_profile.account_number,
            'account_holder': bank_profile.account_holder,
            'is_deleted': False,
        }
        
        return JsonResponse({
            'success': True,
            'account_info': account_info,
            'message_id': message.id
        })
        
    except Exception as e:
        print(f"send_account_info 에러: {e}")
        return JsonResponse({
            'success': False,
            'error': f'서버 오류가 발생했습니다: {str(e)}'
        })

# ✅ 수정된 주소 정보 메시지 전송 함수 (읽음 처리 개선)
@require_POST
@login_required
def send_address_info(request, room_id):
    """주소정보 전송"""
    try:
        room = get_object_or_404(ChatRoom, id=room_id)
        sender = request.user
        
        # 채팅방 참여자 확인
        if sender not in [room.buyer, room.seller]:
            return JsonResponse({
                'success': False,
                'error': '채팅방 참여자만 주소정보를 보낼 수 있습니다.'
            })
        
        # 거래 완료 상태 확인
        if room.is_fully_completed:
            return JsonResponse({
                'success': False,
                'error': '이미 완료된 거래입니다.'
            })
        
        # receiver 계산
        receiver = room.seller if sender == room.buyer else room.buyer
        
        # AddressProfile에서 주소정보 확인
        address_profile = sender.get_address_profile()
        
        if not address_profile or not all([address_profile.postal_code, address_profile.road_address or address_profile.jibun_address]):
            return JsonResponse({
                'success': False,
                'redirect_to_mypage': True,
                'error': '주소 정보를 먼저 등록해주세요.'
            })
        
        # 트랜잭션으로 메시지와 주소 정보를 함께 생성
        with transaction.atomic():
            message = Message.objects.create(
                room=room,
                sender=sender,
                receiver=receiver,  # ✅ receiver 설정
                message_type='address_info'
            )
            
            AddressMessage.objects.create(
                message=message,
                address_profile=address_profile,
            )
        
        # 클라이언트로 전송할 주소정보
        address_info = {
            'postal_code': address_profile.postal_code,
            'road_address': address_profile.road_address,
            'jibun_address': address_profile.jibun_address,
            'detail_address': address_profile.detail_address,
            'building_name': address_profile.building_name,
            'sido': address_profile.sido,
            'sigungu': address_profile.sigungu,
            'full_address': address_profile.full_address,
            'is_deleted': False,
        }
        
        return JsonResponse({
            'success': True,
            'address_info': address_info,
            'message_id': message.id
        })
        
    except Exception as e:
        print(f"send_address_info 에러: {e}")
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
        
        # 더치트 서비스 사용
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