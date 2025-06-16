# 관리자 기능들
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.core.paginator import Paginator
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
import logging

from ..models import BdayCafe
from ..utils.cafe_utils import get_cafe_detail_context 
from ..utils.map_utils import get_map_context, get_nearby_cafes 
from .decorators import admin_required

logger = logging.getLogger(__name__)
@admin_required
def admin_dashboard(request):
    """관리자 대시보드"""
    # 통계 데이터 캐싱
    stats = cache.get('admin_stats')
    if not stats:
        stats = {
            'pending': BdayCafe.objects.filter(status='pending').count(),
            'approved': BdayCafe.objects.filter(status='approved').count(),
            'rejected': BdayCafe.objects.filter(status='rejected').count(),
            'total': BdayCafe.objects.count(),
            'this_month': BdayCafe.objects.filter(
                created_at__year=timezone.now().year,
                created_at__month=timezone.now().month
            ).count(),
        }
        cache.set('admin_stats', stats, 300)  # 5분 캐시
    
    # 최근 카페들 (5개)
    recent_cafes = BdayCafe.objects.select_related(
        'artist', 'member', 'submitted_by'
    ).order_by('-created_at')[:5]
    
    # 승인 대기중인 카페들 (10개)
    pending_cafes = BdayCafe.objects.filter(status='pending').select_related(
        'artist', 'member', 'submitted_by'
    ).order_by('created_at')[:10]
    
    # 최근 거절된 카페들 (3개) - 선택사항
    rejected_cafes = BdayCafe.objects.filter(status='rejected').select_related(
        'artist', 'member', 'submitted_by'
    ).order_by('-created_at')[:3]

    return render(request, 'admin/ddoksang/dashboard.html', {
        'stats': stats,
        'recent_cafes': recent_cafes,
        'pending_cafes': pending_cafes,
        'rejected_cafes': rejected_cafes,
    })

@admin_required
def admin_cafe_list(request):
    """관리자 카페 목록"""
    status_filter = request.GET.get('status', '')
    page = request.GET.get('page', 1)
    
    cafes = BdayCafe.objects.select_related('artist', 'member', 'submitted_by').order_by('-created_at')
    
    if status_filter:
        cafes = cafes.filter(status=status_filter)
    
    # 페이징 처리
    paginator = Paginator(cafes, 20)
    cafes_page = paginator.get_page(page)
    
    context = {
        'cafes': cafes_page,
        'status_filter': status_filter,
        'status_choices': BdayCafe.STATUS_CHOICES,
    }
    return render(request, 'admin/ddoksang/cafe_list.html', context)

@admin_required
@require_POST
def approve_cafe(request, cafe_id):
    """카페 승인"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id)
        cafe.status = 'approved'
        cafe.verified_at = timezone.now()
        cafe.verified_by = request.user
        cafe.save()
        
        # 관련 캐시 무효화
        cache.delete_many([
            'admin_stats',
            'featured_cafes',
            'recent_cafes',
        ])
        
        messages.success(request, f"'{cafe.cafe_name}' 생카가 승인되었습니다.")
        logger.info(f"카페 승인: {cafe.id} by {request.user.username}")
        
    except Exception as e:
        logger.error(f"카페 승인 오류: {e}")
        messages.error(request, "승인 처리 중 오류가 발생했습니다.")
    
    # 이전 페이지로 돌아가기 (대시보드 또는 카페 목록)
    next_url = request.GET.get('next')
    if next_url and next_url in ['dashboard', 'cafe_list']:
        if next_url == 'dashboard':
            return redirect('ddoksang:admin_dashboard')
        else:
            return redirect('ddoksang:admin_cafe_list')
    return redirect('ddoksang:admin_dashboard')

@admin_required
@require_POST
def reject_cafe(request, cafe_id):
    """카페 거절"""
    try:
        cafe = get_object_or_404(BdayCafe, id=cafe_id)
        cafe.status = 'rejected'
        cafe.verified_at = timezone.now()
        cafe.verified_by = request.user
        cafe.save()
        
        # 관련 캐시 무효화
        cache.delete('admin_stats')
        
        messages.success(request, f"'{cafe.cafe_name}' 생카가 거절되었습니다.")
        logger.info(f"카페 거절: {cafe.id} by {request.user.username}")
        
    except Exception as e:
        logger.error(f"카페 거절 오류: {e}")
        messages.error(request, "거절 처리 중 오류가 발생했습니다.")
    
    # 이전 페이지로 돌아가기 (대시보드 또는 카페 목록)
    next_url = request.GET.get('next')
    if next_url and next_url in ['dashboard', 'cafe_list']:
        if next_url == 'dashboard':
            return redirect('ddoksang:admin_dashboard')
        else:
            return redirect('ddoksang:admin_cafe_list')
    return redirect('ddoksang:admin_dashboard')

@admin_required
def admin_preview_cafe(request, cafe_id):
    """관리자 미리보기 (모든 카페, 상태 무관)"""
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    
    context = get_cafe_detail_context(
        cafe, 
        request.user, 
        is_preview=True, 
        can_edit=False, 
        preview_type='admin'
    )
    return render(request, 'ddoksang/detail.html', context)