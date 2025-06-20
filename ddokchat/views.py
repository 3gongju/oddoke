from django.shortcuts import render, redirect, get_object_or_404
from .models import ChatRoom, Message, TextMessage, ImageMessage, AccountInfoMessage, AddressMessage
from accounts.models import MannerReview, User
from accounts.forms import MannerReviewForm
from django.contrib.auth.decorators import login_required
from django.contrib.contenttypes.models import ContentType
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost, ItemPrice
from django.db.models import Q, Max, Count, Prefetch, Case, When, OuterRef, Subquery
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST
from django.core.files.storage import default_storage
from django.urls import reverse
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import datetime
from itertools import groupby
from operator import attrgetter
from .services import get_dutcheat_service
from django.contrib.contenttypes.models import ContentType

import json

# Create your views here.

# 채팅방
@login_required 
def chat_room(request, room_id):
    # N+1 해결: 관련 데이터 한번에 로드
    room = get_object_or_404(
        ChatRoom.objects.select_related(
            'buyer', 'seller', 'content_type'  # content_type도 추가
        ),
        id=room_id
    )

    current_user = request.user
    other_user = room.seller if room.buyer == current_user else room.buyer
    room.other_user = other_user

    # 🔧 카테고리 설정 개선
    # ContentType을 이용해서 정확한 카테고리 문자열 설정
    if room.content_type.model == 'farmsellpost':
        room.category = 'sell'
    elif room.content_type.model == 'farmrentalpost':
        room.category = 'rental'
    elif room.content_type.model == 'farmsplitpost':
        room.category = 'split'
    else:
        # 기본값 설정 (혹시 모를 다른 타입)
        room.category = 'sell'

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
    if room.category == 'split':  # 🔧 수정된 카테고리 사용
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
            # 신청한 멤버들의 가격 합계 계산
            total_price = sum(
                room.post.member_prices.filter(
                    member__in=application.members.all()
                ).values_list('price', flat=True)
            )
            
            split_info = {
                'applied_members': application.members.all(),
                'total_price': total_price  # 신청한 멤버들의 가격 합계
            }

    context = {
        'room': room,
        'messages': messages,
        'current_user': current_user,
        'other_user': other_user,
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
    current_user = request.user
    
    # ✅ ContentType 미리 캐싱
    sell_ct = ContentType.objects.get_for_model(FarmSellPost)
    rental_ct = ContentType.objects.get_for_model(FarmRentalPost)
    split_ct = ContentType.objects.get_for_model(FarmSplitPost)
    
    # 기본 쿼리 (GenericForeignKey와 member_prices 제외)
    rooms = ChatRoom.objects.filter(
        Q(buyer=current_user) | Q(seller=current_user)
    ).select_related(
        'buyer', 'seller', 'content_type'
    ).prefetch_related(
        Prefetch(
            'messages',
            queryset=Message.objects.select_related('sender', 'receiver')
                                   .prefetch_related('text_content')
                                   .order_by('-timestamp')[:1],
            to_attr='latest_messages'
        )
    ).annotate(
        unread_count=Count(
            'messages',
            filter=Q(
                messages__receiver=current_user,
                messages__is_read=False
            )
        ),
        last_message_time=Max('messages__timestamp'),
        partner_id=Case(
            When(buyer=current_user, then='seller_id'),
            default='buyer_id'
        ),
        partner_username=Case(
            When(buyer=current_user, then='seller__username'),
            default='buyer__username'
        )
    ).order_by('-last_message_time')
    
    # ✅ 게시글 타입별로 ID 수집 - ContentType으로 더 정확하게
    sell_post_ids = []
    rental_post_ids = []
    split_post_ids = []
    
    for room in rooms:
        try:
            if room.content_type == sell_ct:
                sell_post_ids.append(room.object_id)
            elif room.content_type == rental_ct:
                rental_post_ids.append(room.object_id)
            elif room.content_type == split_ct:
                split_post_ids.append(room.object_id)
        except Exception as e:
            print(f"ContentType 확인 오류: {e}")
            continue
    
    # ✅ 모든 관련 데이터 한 번에 가져오기
    item_prices_dict = {}
    member_prices_dict = {}
    
    # ItemPrice 가져오기 (양도/대여용)
    try:
        if sell_post_ids:
            sell_prices = ItemPrice.objects.filter(
                content_type=sell_ct, 
                object_id__in=sell_post_ids
            ).select_related()
            
            for price in sell_prices:
                key = f"sell_{price.object_id}"
                if key not in item_prices_dict:
                    item_prices_dict[key] = []
                item_prices_dict[key].append(price)
        
        if rental_post_ids:
            rental_prices = ItemPrice.objects.filter(
                content_type=rental_ct, 
                object_id__in=rental_post_ids
            ).select_related()
            
            for price in rental_prices:
                key = f"rental_{price.object_id}"
                if key not in item_prices_dict:
                    item_prices_dict[key] = []
                item_prices_dict[key].append(price)
                
    except Exception as e:
        print(f"ItemPrice 조회 오류: {e}")
    
    # MemberPrice 가져오기 (분철용)
    try:
        if split_post_ids:
            split_posts = FarmSplitPost.objects.filter(
                id__in=split_post_ids
            ).prefetch_related('member_prices')
            
            for post in split_posts:
                key = f"split_{post.id}"
                member_prices_dict[key] = list(post.member_prices.all())
                
    except Exception as e:
        print(f"분철 MemberPrice 조회 오류: {e}")
    
    # ✅ 캐시된 데이터를 각 room의 post에 설정 - 속성명 통일
    for room in rooms:
        try:
            # ContentType으로 카테고리 판단
            if room.content_type == sell_ct:
                category = 'sell'
            elif room.content_type == rental_ct:
                category = 'rental'
            elif room.content_type == split_ct:
                category = 'split'
            else:
                category = 'unknown'
            
            post_id = room.object_id
            
            if category in ['sell', 'rental']:
                # ItemPrice 설정 - 속성명 통일
                key = f"{category}_{post_id}"
                cached_prices = item_prices_dict.get(key, [])
                
                # ✅ 속성명 통일: _cached_item_prices로 설정
                room.post._cached_item_prices = cached_prices
                # 템플릿 접근용도 유지
                room.post.cached_item_prices = cached_prices
                    
            elif category == 'split':
                # MemberPrice 설정 - 속성명 통일
                key = f"split_{post_id}"
                cached_prices = member_prices_dict.get(key, [])
                
                # ✅ 속성명 통일: _cached_member_prices로 설정
                room.post._cached_member_prices = cached_prices
                # 템플릿 접근용도 유지
                room.post.cached_member_prices = cached_prices
            else:
                # 알 수 없는 타입의 경우 빈 리스트로 설정
                room.post._cached_item_prices = []
                room.post._cached_member_prices = []
                room.post.cached_item_prices = []
                room.post.cached_member_prices = []
                
        except Exception as e:
            print(f"캐시 설정 오류 (room {room.id}): {e}")
            # 오류 시 안전하게 빈 리스트 설정
            room.post._cached_item_prices = []
            room.post._cached_member_prices = []
            room.post.cached_item_prices = []
            room.post.cached_member_prices = []
    
    # 기본 후처리
    for room in rooms:
        room.partner = room.get_other_user(current_user)
        room.last_message = room.latest_messages[0] if room.latest_messages else None
        
        # ✅ ContentType으로 카테고리 설정
        if room.content_type == sell_ct:
            room.category = 'sell'
        elif room.content_type == rental_ct:
            room.category = 'rental'
        elif room.content_type == split_ct:
            room.category = 'split'
        else:
            room.category = 'unknown'

    # ✅ 분철 채팅방과 일반 채팅방 분리 (사용자 역할 고려)
    split_rooms = []
    other_rooms = []
    
    for room in rooms:
        if room.content_type == split_ct:
            # 총대(판매자)인 경우만 그룹핑, 참여자는 일반 채팅처럼 처리
            if current_user == room.seller:
                split_rooms.append(room)
            else:
                other_rooms.append(room)
        else:
            other_rooms.append(room)
    
    # ✅ 분철 채팅방들을 게시글별로 그룹핑
    split_groups = []
    if split_rooms:
        # 같은 게시글별로 정렬
        split_rooms_sorted = sorted(split_rooms, key=lambda x: x.object_id)
        
        # itertools.groupby로 그룹핑
        for post_id, group_rooms in groupby(split_rooms_sorted, key=attrgetter('object_id')):
            group_rooms_list = list(group_rooms)  # iterator를 리스트로 변환
            
            if group_rooms_list:
                # 그룹 내에서 최신 메시지 시간순으로 정렬
                group_rooms_list.sort(key=lambda x: x.last_message_time or timezone.make_aware(datetime.min), reverse=True)
                
                # ✅ 새로 추가: 최근 활동한 대화 상대방들 분석
                recent_partners = []
                latest_message = None
                latest_message_time = None
                
                # ✅ 새로 추가: 각 참여자의 멤버 정보 매핑
                partner_member_map = {}
                split_post = group_rooms_list[0].post  # FarmSplitPost 객체
                
                # 분철 신청 정보들을 가져와서 각 참여자가 어떤 멤버인지 매핑
                from ddokfarm.models import SplitApplication
                applications = SplitApplication.objects.filter(
                    post=split_post,
                    status='approved'
                ).prefetch_related('members')
                
                for application in applications:
                    user = application.user
                    applied_members = application.members.all()
                    if applied_members:
                        # 첫 번째 멤버를 대표로 사용 (보통 하나만 선택하므로)
                        partner_member_map[user] = applied_members[0].member_name
                
                # 최근 활동 기준: 읽지 않은 메시지가 있거나, 최근 메시지가 있는 상대방
                for room in group_rooms_list:
                    # 전체 중 가장 최근 메시지 찾기
                    if room.last_message:
                        if not latest_message or room.last_message.timestamp > latest_message_time:
                            latest_message = room.last_message
                            latest_message_time = room.last_message.timestamp
                    
                    # 최근 활동 기준: 읽지 않은 메시지가 있거나, 최근 메시지가 있는 상대방
                    partner = room.get_other_user(current_user)  # 상대방 가져오기
                    
                    # 읽지 않은 메시지가 있는 상대방이거나, 가장 최근 메시지를 주고받은 상대방
                    has_unread = room.unread_count > 0
                    has_recent_activity = room.last_message and room.last_message.timestamp
                    
                    if (has_unread or has_recent_activity) and partner not in recent_partners:
                        recent_partners.append(partner)
                
                # ✅ 2명 이상이 최근에 활동했는지 확인
                has_multiple_partners = len(recent_partners) >= 2
                
                # 그룹 정보 생성
                first_room = group_rooms_list[0]
                
                group_info = {
                    'type': 'split_group',
                    'post': first_room.post,
                    'post_id': post_id,
                    'rooms': group_rooms_list,
                    'room_count': len(group_rooms_list),
                    'total_unread': sum(room.unread_count for room in group_rooms_list),
                    'latest_message_time': max(
                        (room.last_message_time for room in group_rooms_list if room.last_message_time), 
                        default=timezone.make_aware(datetime.min)
                    ),
                    'is_completed': all(room.is_fully_completed for room in group_rooms_list),
                    'total_price': None,  # 필요시 계산 로직 추가
                    
                    # ✅ 수정된 필드들 - 대화 상대방들 기준
                    'has_multiple_partners': has_multiple_partners,
                    'recent_partners': recent_partners,  # 최근 활동한 상대방들
                    'latest_message': latest_message,
                    'primary_partner': recent_partners[0] if recent_partners else None,  # 대표 상대방
                    
                    # ✅ 새로 추가: 멤버 정보 매핑
                    'partner_member_map': partner_member_map,  # {user: member_name} 매핑
                }
                split_groups.append(group_info)
    
    # ✅ 일반 채팅방에 type 추가
    for room in other_rooms:
        room.type = 'single_room'
    
    # ✅ 모든 아이템을 최신 메시지 시간순으로 통합 정렬
    def get_latest_time(item):
        if isinstance(item, dict) and item.get('type') == 'split_group':
            return item['latest_message_time'] or timezone.make_aware(datetime.min)
        else:
            return item.last_message_time or timezone.make_aware(datetime.min)
    
    # 거래중/완료 분리
    active_split_groups = [group for group in split_groups if not group['is_completed']]
    completed_split_groups = [group for group in split_groups if group['is_completed']]
    
    active_other_rooms = [room for room in other_rooms if not room.is_fully_completed]
    completed_other_rooms = [room for room in other_rooms if room.is_fully_completed]
    
    # 통합하여 시간순 정렬
    active_items = sorted(
        active_split_groups + active_other_rooms,
        key=get_latest_time,
        reverse=True
    )
    
    completed_items = sorted(
        completed_split_groups + completed_other_rooms,
        key=get_latest_time,
        reverse=True
    )

    context = {
        'rooms': rooms,
        'active_rooms': active_other_rooms,  # 기존 호환성을 위해 유지
        'completed_rooms': completed_other_rooms,  # 기존 호환성을 위해 유지
        'active_items': active_items,  # ✅ 새로 추가: 통합된 아이템 리스트
        'completed_items': completed_items,  # ✅ 새로 추가: 통합된 아이템 리스트
        'active_split_groups': active_split_groups,  # 빈 상태 체크용
        'completed_split_groups': completed_split_groups,  # 빈 상태 체크용
        'current_user': current_user,
    }
    return render(request, 'ddokchat/my_rooms.html', context)
    
@login_required
@require_POST
def upload_image(request):
    if 'image' not in request.FILES or 'room_id' not in request.POST:
        return JsonResponse({'success': False, 'error': '요청이 잘못되었습니다.'}, status=400)

    image_file = request.FILES['image']
    room_id = request.POST['room_id']
    
    # ✅ EXIF 데이터 받기
    taken_datetime_str = request.POST.get('taken_datetime')  # ISO 8601 형식

    try:
        room = ChatRoom.objects.get(id=room_id)
        
        if not room.is_participant(request.user):
            return JsonResponse({'success': False, 'error': '권한이 없습니다.'}, status=403)
        
        sender = request.user
        receiver = room.get_other_user(sender)
        
        # 거래 완료 상태 확인
        if room.is_fully_completed:
            return JsonResponse({'success': False, 'error': '이미 완료된 거래입니다.'}, status=400)
        
        # ✅ taken_datetime 파싱
        taken_datetime = None
        if taken_datetime_str:
            try:
                from django.utils import timezone
                from datetime import datetime
                
                # ISO 8601 형식 파싱
                parsed_datetime = datetime.fromisoformat(taken_datetime_str.replace('Z', '+00:00'))
                
                # 타임존 인식 datetime으로 변환
                if timezone.is_naive(parsed_datetime):
                    taken_datetime = timezone.make_aware(parsed_datetime, timezone.utc)
                else:
                    taken_datetime = parsed_datetime
                    
                print(f"✅ EXIF 촬영시간 파싱 성공: {taken_datetime}")
                
            except (ValueError, TypeError) as e:
                print(f"❌ EXIF 날짜 파싱 실패: {e}")
                taken_datetime = None
        
        # 트랜잭션으로 메시지와 이미지 정보를 함께 생성
        with transaction.atomic():
            message = Message.objects.create(
                room=room,
                sender=sender,
                receiver=receiver,
                message_type='image'
            )
            
            # ✅ taken_datetime 포함해서 이미지 메시지 생성
            image_message = ImageMessage.objects.create(
                message=message,
                image=image_file,
                taken_datetime=taken_datetime  # EXIF 촬영시간 저장
            )
        
        return JsonResponse({
            'success': True, 
            'image_url': image_message.image.url,
            'message_id': message.id,
            'taken_datetime': taken_datetime.isoformat() if taken_datetime else None  # ✅ 추가
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

    if not room.is_participant(current_user):
        return JsonResponse({'success': False, 'error': '권한이 없습니다.'}, status=403)

    if room.get_completion_status_for_user(current_user):
        return JsonResponse({'success': False, 'error': '이미 거래완료 처리하셨습니다.'}, status=400)

    user_role = room.get_user_role(current_user)

    if user_role == 'buyer':
        room.buyer_completed = True
    elif user_role == 'seller':
        room.seller_completed = True

    room.save()

    is_fully_completed = room.is_fully_completed

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
        'user_role': user_role,
        'message': f'{"구매자" if user_role == "buyer" else "판매자"} 거래완료 처리되었습니다.'
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
        if not room.is_participant(sender):
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
        receiver = room.get_other_user(sender)
        
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
    """배송정보 전송 - 핸드폰 번호 포함"""
    try:
        room = get_object_or_404(ChatRoom, id=room_id)
        sender = request.user
        
        # 채팅방 참여자 확인
        if not room.is_participant(sender):
            return JsonResponse({
                'success': False,
                'error': '채팅방 참여자만 배송정보를 보낼 수 있습니다.'
            })
        
        # 거래 완료 상태 확인
        if room.is_fully_completed:
            return JsonResponse({
                'success': False,
                'error': '이미 완료된 거래입니다.'
            })
        
        # receiver 계산
        receiver = room.get_other_user(sender)
        
        # AddressProfile에서 배송정보 확인
        address_profile = sender.get_address_profile()
        
        # 필수 필드 체크 - 핸드폰 번호 포함
        if not address_profile or not all([
            address_profile.postal_code, 
            address_profile.road_address,
            address_profile.phone_number
        ]):
            return JsonResponse({
                'success': False,
                'redirect_to_mypage': True,
                'error': '배송 정보(주소, 핸드폰 번호)를 먼저 등록해주세요.'
            })
        
        # 트랜잭션으로 메시지와 배송 정보를 함께 생성
        with transaction.atomic():
            message = Message.objects.create(
                room=room,
                sender=sender,
                receiver=receiver,
                message_type='address_info'
            )
            
            AddressMessage.objects.create(
                message=message,
                address_profile=address_profile,
            )
        
        # 클라이언트로 전송할 배송정보 - 핸드폰 번호 포함
        address_info = {
            'postal_code': address_profile.postal_code,
            'road_address': address_profile.road_address,
            'detail_address': address_profile.detail_address or '',
            'phone_number': address_profile.phone_number,
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
    """계좌 사기 이력 조회 - 예금주명 제거 버전"""
    try:
        data = json.loads(request.body)
        bank_code = data.get('bank_code', '').strip()  # 빈 값 허용
        account_number = data.get('account_number', '').strip()
        account_holder = data.get('account_holder', '').strip()  # 빈 값 허용
        
        # ✅ 입력값 검증: 계좌번호만 필수
        if not account_number:
            return JsonResponse({
                'success': False,
                'error': '계좌번호를 입력해주세요.'
            })
        
        # ✅ 계좌번호 정규화 (하이픈, 공백 제거)
        clean_account_number = account_number.replace('-', '').replace(' ', '')
        
        # ✅ 계좌번호 길이 검증 (최소 10자리)
        if len(clean_account_number) < 10:
            return JsonResponse({
                'success': False,
                'error': '올바른 계좌번호를 입력해주세요. (최소 10자리)'
            })
        
        # 더치트 서비스 사용
        try:
            dutcheat_service = get_dutcheat_service()
            result = dutcheat_service.check_account_fraud_history(
                bank_code=bank_code if bank_code else None,  # 빈 값이면 None 전달
                account_number=clean_account_number,  # ✅ 정규화된 계좌번호 사용
                account_holder=account_holder if account_holder else None  # ✅ 빈 값이면 None 전달
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
                return _get_dummy_fraud_data(clean_account_number)
                
        except Exception as e:
            # 서비스 오류 시 더미 데이터로 폴백
            return _get_dummy_fraud_data(clean_account_number)
        
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