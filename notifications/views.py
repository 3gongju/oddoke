from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from django.contrib import messages
import json
from .models import Notification


@login_required
def notification_list(request):
    """알림 목록 페이지"""
    notifications = Notification.objects.filter(
        recipient=request.user
    ).select_related('actor', 'content_type').order_by('-created_at')
    
    # 페이지네이션
    paginator = Paginator(notifications, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    if request.headers.get('Accept') == 'application/json':
        # AJAX 요청인 경우 JSON 응답
        notifications_data = []
        for notification in page_obj:
            notifications_data.append({
                'id': notification.id,
                'notification_type': notification.notification_type,
                'message': notification.message,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat(),
                'actor_name': notification.actor.first_name or notification.actor.username,
                'actor_username': notification.actor.username,
                'time_since': get_time_since(notification.created_at),
            })
        
        return JsonResponse({
            'notifications': notifications_data,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous(),
            'page_number': page_obj.number,
            'total_pages': paginator.num_pages,
        })
    
    # 일반 페이지 요청
    context = {
        'page_obj': page_obj,
        'unread_count': notifications.filter(is_read=False).count()
    }
    return render(request, 'notifications/notification_list.html', context)


@login_required
@require_http_methods(["POST"])
def mark_notification_read(request, notification_id):
    """특정 알림을 읽음으로 표시 (통합 읽음 처리 적용)"""
    notification = get_object_or_404(
        Notification, 
        id=notification_id, 
        recipient=request.user
    )
    
    # ✅ 통합 읽음 처리 적용
    related_count = notification.mark_as_read_with_related()
    
    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'message': f'{related_count}개의 알림이 읽음으로 표시되었습니다.' if related_count > 1 else '알림이 읽음으로 표시되었습니다.',
            'notification_id': notification_id,
            'related_count': related_count
        })
    
    message_text = f'{related_count}개의 알림이 읽음으로 표시되었습니다.' if related_count > 1 else '알림이 읽음으로 표시되었습니다.'
    messages.success(request, message_text)
    return redirect('notifications:notification_list')

@login_required
@require_http_methods(["POST"])
def mark_all_notifications_read(request):
    """모든 알림을 읽음으로 표시"""
    updated_count = Notification.objects.filter(
        recipient=request.user,
        is_read=False
    ).update(is_read=True)
    
    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'message': f'{updated_count}개의 알림이 읽음으로 표시되었습니다.',
            'updated_count': updated_count
        })
    
    messages.success(request, f'{updated_count}개의 알림이 읽음으로 표시되었습니다.')
    return redirect('notifications:notification_list')


@login_required
def unread_notification_count(request):
    """읽지 않은 알림 개수 조회 (AJAX용)"""
    count = Notification.objects.filter(
        recipient=request.user,
        is_read=False
    ).count()
    
    return JsonResponse({
        'unread_count': count
    })


@login_required
@require_http_methods(["POST"])
def delete_notification(request, notification_id):
    """특정 알림 삭제"""
    notification = get_object_or_404(
        Notification,
        id=notification_id,
        recipient=request.user
    )
    
    notification.delete()
    
    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'message': '알림이 삭제되었습니다.'
        })
    
    messages.success(request, '알림이 삭제되었습니다.')
    return redirect('notifications:notification_list')


def get_time_since(created_at):
    """생성 시간을 상대적 시간으로 표시"""
    from django.utils import timezone
    from datetime import timedelta
    
    now = timezone.now()
    diff = now - created_at
    
    if diff < timedelta(minutes=1):
        return "방금 전"
    elif diff < timedelta(hours=1):
        minutes = int(diff.total_seconds() / 60)
        return f"{minutes}분 전"
    elif diff < timedelta(days=1):
        hours = int(diff.total_seconds() / 3600)
        return f"{hours}시간 전"
    elif diff < timedelta(days=7):
        days = diff.days
        return f"{days}일 전"
    else:
        return created_at.strftime("%Y-%m-%d")


@login_required
def goto_content(request, notification_id):
    """알림 내용으로 이동 (통합 읽음 처리 적용)"""
    notification = get_object_or_404(
        Notification,
        id=notification_id,
        recipient=request.user
    )
    
    # ✅ 통합 읽음 처리 적용
    related_count = notification.mark_as_read_with_related()
    
    # 읽음 처리 결과 로깅
    if related_count > 1:
        print(f"통합 읽음 처리: {related_count}개 알림 처리됨")
    
    try:
        content_object = notification.content_object
        if not content_object:
            messages.warning(request, '해당 내용을 찾을 수 없습니다.')
            return redirect('notifications:notification_list')
        
        notification_type = notification.notification_type
        model_name = notification.content_type.model.lower()
        
        # 1. 분철 참여 신청 알림 → 분철 관리 페이지로
        if notification_type == 'split_application':
            return redirect('ddokfarm:manage_split_applications', 
                          category='split', post_id=content_object.id)
        
        # 2. 채팅 알림 → 내 채팅 목록으로
        elif notification_type == 'chat':
            return redirect('ddokchat:my_chatrooms')
        
        # 3. 팔로우 알림 → 상대방 공개 프로필로
        elif notification_type == 'follow' and model_name == 'user':
            return redirect('accounts:profile', username=content_object.username)
        
        # 4. 생일카페 승인/반려 알림 → 내 카페 목록으로
        elif notification_type in ['cafe_approved', 'cafe_rejected']:
            if model_name == 'bdaycafe':
                return redirect('ddoksang:my_cafes')
            else:
                return redirect('ddoksang:home')
        
        # 5. 팬덤 인증 승인/반려 알림 → 설정 페이지로
        elif notification_type in ['fandom_verified', 'fandom_rejected']:
            if model_name == 'fandomprofile':
                return redirect('accounts:settings_main', username=request.user.username)
            else:
                return redirect('accounts:mypage')
        
        # 6. 댓글/대댓글/게시글답글 알림 → 해당 게시글의 댓글 위치로
        elif notification_type in ['comment', 'reply', 'post_reply']:
            # content_object는 이제 게시글 객체 (댓글 그룹핑 변경으로)
            post_url = get_post_url(content_object)
            return redirect(post_url)
        
        # 7. 좋아요 알림 → 해당 게시글로
        elif notification_type == 'like':
            post_url = get_post_url(content_object)
            return redirect(post_url)
        
        # 8. 분철 승인/반려 알림 → 해당 분철 게시글로
        elif notification_type in ['split_approved', 'split_rejected']:
            post_url = get_post_url(content_object)
            return redirect(post_url)
        
        # 9. 기타 게시글 관련 알림 → 해당 게시글로
        elif hasattr(content_object, 'id'):
            post_url = get_post_url(content_object)
            return redirect(post_url)
        
        else:
            messages.warning(request, '해당 페이지로 이동할 수 없습니다.')
            return redirect('notifications:notification_list')
            
    except Exception as e:
        messages.error(request, '페이지로 이동하는 중 오류가 발생했습니다.')
        return redirect('notifications:notification_list')


def get_post_url(post):
    """게시글 모델에 따른 URL 반환"""
    model_name = post._meta.model_name.lower()
    
    # 모델명에 따른 카테고리 매핑
    category_mapping = {
        'farmsellpost': 'sell',
        'farmrentalpost': 'rental', 
        'farmsplitpost': 'split',
        'damcommunitypost': 'community',
        'dammannerpost': 'manner',
        'dambdaycafepost': 'bdaycafe',
    }
    
    # ddokfarm 게시글인 경우
    if model_name in ['farmsellpost', 'farmrentalpost', 'farmsplitpost']:
        category = category_mapping[model_name]
        return f'/ddokfarm/{category}/{post.id}/'
    
    # ddokdam 게시글인 경우
    elif model_name in ['damcommunitypost', 'dammannerpost', 'dambdaycafepost']:
        category = category_mapping[model_name]
        return f'/ddokdam/{category}/{post.id}/'
    
    return '/'