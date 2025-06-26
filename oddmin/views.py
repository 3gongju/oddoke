from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.utils import timezone
from django.core.paginator import Paginator
from django.core.cache import cache
from django.views.decorators.http import require_POST
from django.contrib.contenttypes.models import ContentType
from datetime import timedelta
import logging

from ddoksang.models import BdayCafe
from accounts.models import FandomProfile
from notifications.models import Notification
from .decorators import oddmin_required

logger = logging.getLogger(__name__)


# ===== 대시보드 =====

@oddmin_required
def admin_dashboard(request):
    """통합 관리자 대시보드"""
    
    # 캐시 키 생성
    cache_key = 'oddmin_dashboard_stats'
    stats = cache.get(cache_key)
    
    if not stats:
        # 생일카페 통계
        cafe_stats = {
            'pending': BdayCafe.objects.filter(status='pending').count(),
            'approved': BdayCafe.objects.filter(status='approved').count(),
            'rejected': BdayCafe.objects.filter(status='rejected').count(),
            'total': BdayCafe.objects.count(),
        }
        
        # 팬덤 인증 통계  
        fandom_stats = {
            'pending': FandomProfile.objects.filter(is_pending_verification=True).count(),
            'verified': FandomProfile.objects.filter(is_verified_fandom=True).count(),
            'failed': FandomProfile.objects.filter(verification_failed=True).count(),
            'total': FandomProfile.objects.count(),
        }
        
        stats = {
            'cafe': cafe_stats,
            'fandom': fandom_stats,
            'updated_at': timezone.now()
        }
        
        # 5분 캐시
        cache.set(cache_key, stats, 300)
    
    # 긴급 처리 필요 (7일 이상 대기)
    urgent_cafes = BdayCafe.objects.filter(
        status='pending',
        created_at__lte=timezone.now() - timedelta(days=7)
    ).count()
    
    urgent_fandom = FandomProfile.objects.filter(
        is_pending_verification=True,
        applied_at__lte=timezone.now() - timedelta(days=7)
    ).count()
    
    # 최근 대기 항목들
    recent_pending_cafes = BdayCafe.objects.filter(
        status='pending'
    ).select_related('artist', 'member', 'submitted_by').order_by('created_at')[:5]
    
    recent_pending_fandom = FandomProfile.objects.filter(
        is_pending_verification=True
    ).select_related('user', 'fandom_artist').order_by('applied_at')[:5]
    
    context = {
        'stats': stats,
        'urgent': {
            'cafes': urgent_cafes,
            'fandom': urgent_fandom,
            'total': urgent_cafes + urgent_fandom,
        },
        'recent_pending': {
            'cafes': recent_pending_cafes,
            'fandom': recent_pending_fandom,
        }
    }
    
    return render(request, 'oddmin/dashboard.html', context)


# ===== 생일카페 관리 =====

@oddmin_required
def cafe_list(request):
    """생일카페 목록 관리"""
    status_filter = request.GET.get('status', '')
    page = request.GET.get('page', 1)
    
    cafes = BdayCafe.objects.select_related('artist', 'member', 'submitted_by').order_by('-created_at')
    
    if status_filter:
        cafes = cafes.filter(status=status_filter)
    
    # 페이징 처리
    paginator = Paginator(cafes, 20)
    cafes_page = paginator.get_page(page)
    
    # 🔥 추가: dashboard.html에서 필요한 stats와 urgent 정보
    # 캐시에서 가져오거나 새로 생성
    cache_key = 'oddmin_dashboard_stats'
    stats = cache.get(cache_key)
    
    if not stats:
        # 통계 정보 생성 (dashboard와 동일)
        cafe_stats = {
            'pending': BdayCafe.objects.filter(status='pending').count(),
            'approved': BdayCafe.objects.filter(status='approved').count(),
            'rejected': BdayCafe.objects.filter(status='rejected').count(),
            'total': BdayCafe.objects.count(),
        }
        
        fandom_stats = {
            'pending': FandomProfile.objects.filter(is_pending_verification=True).count(),
            'verified': FandomProfile.objects.filter(is_verified_fandom=True).count(),
            'failed': FandomProfile.objects.filter(verification_failed=True).count(),
            'total': FandomProfile.objects.count(),
        }
        
        stats = {
            'cafe': cafe_stats,
            'fandom': fandom_stats,
            'updated_at': timezone.now()
        }
        
        cache.set(cache_key, stats, 300)
    
    # 긴급 처리 정보
    urgent_cafes = BdayCafe.objects.filter(
        status='pending',
        created_at__lte=timezone.now() - timedelta(days=7)
    ).count()
    
    urgent_fandom = FandomProfile.objects.filter(
        is_pending_verification=True,
        applied_at__lte=timezone.now() - timedelta(days=7)
    ).count()
    
    # 최근 대기 항목들 (빈 리스트로 설정, cafe_list에서는 필요없음)
    recent_pending = {
        'cafes': [],
        'fandom': [],
    }
    
    context = {
        'cafes': cafes_page,
        'status_filter': status_filter,
        'status_choices': BdayCafe.STATUS_CHOICES,
        # dashboard.html에서 필요한 변수들 추가
        'stats': stats,
        'urgent': {
            'cafes': urgent_cafes,
            'fandom': urgent_fandom,
            'total': urgent_cafes + urgent_fandom,
        },
        'recent_pending': recent_pending,
    }
    # 🔥 수정: extends 방식으로 변경된 템플릿 경로
    return render(request, 'oddmin/cafe_list.html', context)


@oddmin_required
def cafe_detail(request, cafe_id):
    """생일카페 상세 보기 (미리보기)"""
    cafe = get_object_or_404(
        BdayCafe.objects.select_related('artist', 'member', 'submitted_by')
                        .prefetch_related('images'),
        id=cafe_id
    )
    
    context = {
        'cafe': cafe,
        'is_preview': True,
    }
    # 🔥 수정: extends 방식으로 변경된 템플릿 경로 (향후 생성 예정)
    return render(request, 'oddmin/cafe_detail.html', context)


@oddmin_required
@require_POST
def approve_cafe(request, cafe_id):
    """생일카페 승인"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id)
        previous_status = cafe.status
        
        cafe.status = 'approved'
        cafe.verified_at = timezone.now()
        cafe.verified_by = request.user
        cafe.save()
        
        # ✅ 직접 알림 생성 (pending -> approved만)
        if previous_status == 'pending':
            try:
                notification = Notification.objects.create(
                    recipient=cafe.submitted_by,
                    actor=request.user,
                    notification_type='cafe_approved',
                    content_type=ContentType.objects.get_for_model(cafe),
                    object_id=cafe.id,
                    message=f'등록하신 생일카페 "{cafe.cafe_name}"가 승인되었습니다'
                )
                logger.info(f"생일카페 승인 알림 생성: notification_id={notification.id}")
            except Exception as e:
                logger.error(f"생일카페 승인 알림 생성 오류: {e}")
        
        # 관련 캐시 무효화
        cache.delete_many([
            'oddmin_dashboard_stats',
            'featured_cafes',
            'recent_cafes',
        ])
        
        messages.success(request, f"'{cafe.cafe_name}' 생일카페가 승인되었습니다.")
        logger.info(f"카페 승인: {cafe.id} by {request.user.username}")
        
    except Exception as e:
        logger.error(f"카페 승인 오류: {e}")
        messages.error(request, "승인 처리 중 오류가 발생했습니다.")
    
    next_url = request.POST.get('next', 'dashboard')
    if next_url == 'cafe_list':
        return redirect('oddmin:cafe_list')
    return redirect('oddmin:dashboard')


@oddmin_required
@require_POST
def reject_cafe(request, cafe_id):
    """생일카페 거절"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id)
        previous_status = cafe.status
        
        cafe.status = 'rejected'
        cafe.verified_at = timezone.now()
        cafe.verified_by = request.user
        cafe.save()
        
        # ✅ 직접 알림 생성 (pending -> rejected만)
        if previous_status == 'pending':
            try:
                notification = Notification.objects.create(
                    recipient=cafe.submitted_by,
                    actor=request.user,
                    notification_type='cafe_rejected',
                    content_type=ContentType.objects.get_for_model(cafe),
                    object_id=cafe.id,
                    message=f'등록하신 생일카페 "{cafe.cafe_name}"가 거절되었습니다'
                )
                logger.info(f"생일카페 거절 알림 생성: notification_id={notification.id}")
            except Exception as e:
                logger.error(f"생일카페 거절 알림 생성 오류: {e}")
        
        # 관련 캐시 무효화
        cache.delete('oddmin_dashboard_stats')
        
        messages.success(request, f"'{cafe.cafe_name}' 생일카페가 거절되었습니다.")
        logger.info(f"카페 거절: {cafe.id} by {request.user.username}")
        
    except Exception as e:
        logger.error(f"카페 거절 오류: {e}")
        messages.error(request, "거절 처리 중 오류가 발생했습니다.")
    
    next_url = request.POST.get('next', 'dashboard')
    if next_url == 'cafe_list':
        return redirect('oddmin:cafe_list')
    return redirect('oddmin:dashboard')


# ===== 팬덤 인증 관리 =====

@oddmin_required
def fandom_list(request):
    """팬덤 인증 목록 관리"""
    status_filter = request.GET.get('status', '')
    page = request.GET.get('page', 1)
    
    fandom_profiles = FandomProfile.objects.select_related(
        'user', 'fandom_artist'
    ).order_by('-applied_at')
    
    if status_filter == 'pending':
        fandom_profiles = fandom_profiles.filter(is_pending_verification=True)
    elif status_filter == 'verified':
        fandom_profiles = fandom_profiles.filter(is_verified_fandom=True)
    elif status_filter == 'failed':
        fandom_profiles = fandom_profiles.filter(verification_failed=True)
    
    # 페이징 처리
    paginator = Paginator(fandom_profiles, 20)
    profiles_page = paginator.get_page(page)
    
    # 🔥 추가: dashboard.html에서 필요한 stats와 urgent 정보
    # 캐시에서 가져오거나 새로 생성
    cache_key = 'oddmin_dashboard_stats'
    stats = cache.get(cache_key)
    
    if not stats:
        # 통계 정보 생성 (dashboard와 동일)
        cafe_stats = {
            'pending': BdayCafe.objects.filter(status='pending').count(),
            'approved': BdayCafe.objects.filter(status='approved').count(),
            'rejected': BdayCafe.objects.filter(status='rejected').count(),
            'total': BdayCafe.objects.count(),
        }
        
        fandom_stats = {
            'pending': FandomProfile.objects.filter(is_pending_verification=True).count(),
            'verified': FandomProfile.objects.filter(is_verified_fandom=True).count(),
            'failed': FandomProfile.objects.filter(verification_failed=True).count(),
            'total': FandomProfile.objects.count(),
        }
        
        stats = {
            'cafe': cafe_stats,
            'fandom': fandom_stats,
            'updated_at': timezone.now()
        }
        
        cache.set(cache_key, stats, 300)
    
    # 긴급 처리 정보
    urgent_cafes = BdayCafe.objects.filter(
        status='pending',
        created_at__lte=timezone.now() - timedelta(days=7)
    ).count()
    
    urgent_fandom = FandomProfile.objects.filter(
        is_pending_verification=True,
        applied_at__lte=timezone.now() - timedelta(days=7)
    ).count()
    
    # 최근 대기 항목들 (빈 리스트로 설정, fandom_list에서는 필요없음)
    recent_pending = {
        'cafes': [],
        'fandom': [],
    }
    
    context = {
        'profiles': profiles_page,
        'status_filter': status_filter,
        # dashboard.html에서 필요한 변수들 추가
        'stats': stats,
        'urgent': {
            'cafes': urgent_cafes,
            'fandom': urgent_fandom,
            'total': urgent_cafes + urgent_fandom,
        },
        'recent_pending': recent_pending,
    }
    # 🔥 수정: extends 방식으로 변경된 템플릿 경로
    return render(request, 'oddmin/fandom_list.html', context)


@oddmin_required
def fandom_detail(request, profile_id):
    """팬덤 인증 상세 보기"""
    profile = get_object_or_404(
        FandomProfile.objects.select_related('user', 'fandom_artist'),
        id=profile_id
    )
    
    # 🔥 추가: dashboard.html에서 필요한 stats와 urgent 정보
    # 캐시에서 가져오거나 새로 생성
    cache_key = 'oddmin_dashboard_stats'
    stats = cache.get(cache_key)
    
    if not stats:
        # 통계 정보 생성 (dashboard와 동일)
        cafe_stats = {
            'pending': BdayCafe.objects.filter(status='pending').count(),
            'approved': BdayCafe.objects.filter(status='approved').count(),
            'rejected': BdayCafe.objects.filter(status='rejected').count(),
            'total': BdayCafe.objects.count(),
        }
        
        fandom_stats = {
            'pending': FandomProfile.objects.filter(is_pending_verification=True).count(),
            'verified': FandomProfile.objects.filter(is_verified_fandom=True).count(),
            'failed': FandomProfile.objects.filter(verification_failed=True).count(),
            'total': FandomProfile.objects.count(),
        }
        
        stats = {
            'cafe': cafe_stats,
            'fandom': fandom_stats,
            'updated_at': timezone.now()
        }
        
        cache.set(cache_key, stats, 300)
    
    # 긴급 처리 정보
    urgent_cafes = BdayCafe.objects.filter(
        status='pending',
        created_at__lte=timezone.now() - timedelta(days=7)
    ).count()
    
    urgent_fandom = FandomProfile.objects.filter(
        is_pending_verification=True,
        applied_at__lte=timezone.now() - timedelta(days=7)
    ).count()
    
    # 최근 대기 항목들 (빈 리스트로 설정, fandom_detail에서는 필요없음)
    recent_pending = {
        'cafes': [],
        'fandom': [],
    }
    
    context = {
        'profile': profile,
        'is_preview': True,
        # dashboard.html에서 필요한 변수들 추가
        'stats': stats,
        'urgent': {
            'cafes': urgent_cafes,
            'fandom': urgent_fandom,
            'total': urgent_cafes + urgent_fandom,
        },
        'recent_pending': recent_pending,
    }
    return render(request, 'oddmin/fandom_detail.html', context)


@oddmin_required
@require_POST
def approve_fandom(request, profile_id):
    """팬덤 인증 승인"""
    try:
        profile = get_object_or_404(FandomProfile, id=profile_id)
        
        # 이전 상태 확인 (pending인 경우만 처리)
        if not profile.is_pending_verification:
            messages.warning(request, '승인 대기 중이 아닌 인증입니다.')
            next_url = request.POST.get('next', 'dashboard')
            if next_url == 'fandom_list':
                return redirect('oddmin:fandom_list')
            return redirect('oddmin:dashboard')
        
        # 상태 변경
        profile.is_verified_fandom = True
        profile.is_pending_verification = False
        profile.verification_failed = False
        profile.verified_at = timezone.now()
        profile.save()
        
        # ✅ 직접 알림 생성
        try:
            artist_name = getattr(profile.fandom_artist, 'display_name', '아티스트') if profile.fandom_artist else '아티스트'
            notification = Notification.objects.create(
                recipient=profile.user,
                actor=request.user,
                notification_type='fandom_verified',
                content_type=ContentType.objects.get_for_model(profile),
                object_id=profile.id,
                message=f'{artist_name} 공식 팬덤 인증이 승인되었습니다'
            )
            logger.info(f"팬덤 인증 승인 알림 생성: notification_id={notification.id}")
        except Exception as e:
            logger.error(f"팬덤 인증 승인 알림 생성 오류: {e}")
        
        # 캐시 무효화
        cache.delete('oddmin_dashboard_stats')
        
        messages.success(request, f"{profile.user.username}님의 팬덤 인증이 승인되었습니다.")
        logger.info(f"팬덤 인증 승인: {profile.id} by {request.user.username}")
        
    except Exception as e:
        logger.error(f"팬덤 인증 승인 오류: {e}")
        messages.error(request, "승인 처리 중 오류가 발생했습니다.")
    
    # POST 데이터에서 next 파라미터 확인
    next_url = request.POST.get('next', 'dashboard')
    if next_url == 'fandom_list':
        return redirect('oddmin:fandom_list')
    elif next_url == 'fandom_detail':
        return redirect('oddmin:fandom_detail', profile_id=profile.id)
    return redirect('oddmin:dashboard')


@oddmin_required
@require_POST  
def reject_fandom(request, profile_id):
    """팬덤 인증 거절"""
    try:
        profile = get_object_or_404(FandomProfile, id=profile_id)
        
        # 이전 상태 확인 (pending인 경우만 처리)
        if not profile.is_pending_verification:
            messages.warning(request, '승인 대기 중이 아닌 인증입니다.')
            next_url = request.POST.get('next', 'dashboard')
            if next_url == 'fandom_list':
                return redirect('oddmin:fandom_list')
            return redirect('oddmin:dashboard')
        
        # 상태 변경
        profile.is_verified_fandom = False
        profile.is_pending_verification = False
        profile.verification_failed = True
        profile.save()
        
        # ✅ 직접 알림 생성
        try:
            artist_name = getattr(profile.fandom_artist, 'display_name', '아티스트') if profile.fandom_artist else '아티스트'
            notification = Notification.objects.create(
                recipient=profile.user,
                actor=request.user,
                notification_type='fandom_rejected',
                content_type=ContentType.objects.get_for_model(profile),
                object_id=profile.id,
                message=f'{artist_name} 공식 팬덤 인증이 거절되었습니다'
            )
            logger.info(f"팬덤 인증 거절 알림 생성: notification_id={notification.id}")
        except Exception as e:
            logger.error(f"팬덤 인증 거절 알림 생성 오류: {e}")
        
        # 캐시 무효화
        cache.delete('oddmin_dashboard_stats')
        
        messages.success(request, f"{profile.user.username}님의 팬덤 인증이 거절되었습니다.")
        logger.info(f"팬덤 인증 거절: {profile.id} by {request.user.username}")
        
    except Exception as e:
        logger.error(f"팬덤 인증 거절 오류: {e}")
        messages.error(request, "거절 처리 중 오류가 발생했습니다.")
    
    # POST 데이터에서 next 파라미터 확인
    next_url = request.POST.get('next', 'dashboard')
    if next_url == 'fandom_list':
        return redirect('oddmin:fandom_list')
    elif next_url == 'fandom_detail':
        return redirect('oddmin:fandom_detail', profile_id=profile.id)
    return redirect('oddmin:dashboard')