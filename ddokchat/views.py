from django.shortcuts import render, redirect, get_object_or_404
from .models import ChatRoom
from accounts.models import MannerReview
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
# Create your views here.

# 채팅방
def chat_room(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)

    room.other_user = room.seller if room.buyer == request.user else room.buyer # 상대방 프로필 이미지 추가

    # ✅ 구매자 리뷰 작성 여부 확인
    has_already_reviewed = False
    if request.user == room.buyer and room.buyer_completed and room.seller_completed:
        has_already_reviewed = MannerReview.objects.filter(
            user=request.user,
            target_user=room.seller
        ).exists()

    # 내가 안 읽은 메시지 읽음 처리
    Message.objects.filter(
        Q(room=room) & Q(is_read=False) & ~Q(sender=request.user)
    ).update(is_read=True)

    messages = Message.objects.filter(room=room).select_related('sender').order_by('timestamp')  # 메시지 순서대로 정렬
    
    context = {
        'room': room,
        'messages': messages,
        'user': request.user,
        'form': MannerReviewForm(),
        'has_already_reviewed': str(has_already_reviewed),
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