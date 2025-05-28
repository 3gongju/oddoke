from django.shortcuts import render
from django.http import JsonResponse
from django.utils import timezone
from django.conf import settings
from .models import BdayCafe
import json

def bday_cafe_map(request):  
    """생카 지도 메인 페이지"""
    # 현재 진행 중인 생카들만 가져오기
    active_bday_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=timezone.now().date(),
        end_date__gte=timezone.now().date()
    ).select_related('artist', 'member')
    
    # 지도에 표시할 데이터 준비
    bday_cafe_data = [bday_cafe.get_kakao_map_data() for bday_cafe in active_bday_cafes]
    
    context = {
        'bday_cafes_json': json.dumps(bday_cafe_data),
        'total_bday_cafes': len(bday_cafe_data),
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    
    return render(request, 'ddoksang/map.html', context)

def bday_cafe_list_api(request):  
    """생카 목록 API (테스트용)"""
    bday_cafes = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member').order_by('-start_date')
    
    bday_cafe_data = []
    for bday_cafe in bday_cafes:
        bday_cafe_data.append({
            'id': bday_cafe.id,
            'name': bday_cafe.cafe_name,
            'artist': bday_cafe.artist.name,
            'member': bday_cafe.member.name if bday_cafe.member else None,
            'address': bday_cafe.address,
            'latitude': float(bday_cafe.latitude),
            'longitude': float(bday_cafe.longitude),
            'start_date': bday_cafe.start_date.strftime('%Y-%m-%d'),
            'end_date': bday_cafe.end_date.strftime('%Y-%m-%d'),
            'is_active': bday_cafe.is_active,
            'main_image': bday_cafe.main_image.url if bday_cafe.main_image else None,
        })
    
    return JsonResponse({
        'success': True,
        'bday_cafes': bday_cafe_data,
        'total': len(bday_cafe_data)
    })