from django.shortcuts import render, redirect, get_object_or_404
from .models import ChatRoom
from django.contrib.auth.decorators import login_required
from django.contrib.contenttypes.models import ContentType
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost
from .models import ChatRoom, Message
from django.db.models import Q

# Create your views here.

# 채팅방
def chat_room(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)

    # 내가 안 읽은 메시지 읽음 처리
    Message.objects.filter(
        Q(room=room) & Q(is_read=False) & ~Q(sender=request.user)
    ).update(is_read=True)

    messages = Message.objects.filter(room=room).select_related('sender').order_by('timestamp')  # 메시지 순서대로 정렬
    
    context = {
        'room': room,
        'messages': messages,
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
    )

    rooms = sorted(rooms, key=lambda room: room.messages.last().timestamp if room.messages.exists() else room.created_at, reverse=True)
    
    for room in rooms:
        room.last_message = room.messages.last()
        room.unread_count = room.messages.filter(is_read=False).exclude(sender=request.user).count()

    context = {
        'rooms': rooms,
        'me': request.user,
    }
    return render(request, 'ddokchat/my_rooms.html', context)