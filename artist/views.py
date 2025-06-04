from django.shortcuts import render, get_object_or_404, redirect
from .models import Artist, Member
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.db.models import Q
from django.template.loader import render_to_string

# 아티스트 목록 + 검색 필터 + 찜 여부 분리
def index(request):
    query = request.GET.get('q', '').strip()

    # 전체 필터 조건
    base_queryset = Artist.objects.all()
    if query:
        base_queryset = base_queryset.filter(
            Q(display_name__icontains=query) |
            Q(korean_name__icontains=query) |
            Q(english_name__icontains=query) |
            Q(alias__icontains=query)
        )

    # 찜한 아티스트와 그 외 아티스트 구분
    if request.user.is_authenticated:
        favourite_artists = base_queryset.filter(followers=request.user).order_by('id')
        other_artists = base_queryset.exclude(followers=request.user).order_by('id')
    else:
        favourite_artists = []
        other_artists = base_queryset.order_by('id')

    return render(request, 'artist/index.html', {
        'query': query,
        'favourite_artists': favourite_artists,
        'other_artists': other_artists,
    })

# 찜 토글
@login_required
def toggle_favorite(request, artist_id):
    artist = get_object_or_404(Artist, id=artist_id)
    if request.user in artist.followers.all():
        artist.followers.remove(request.user)

        # 아티스트 팔로우 취소 시 팔로우한 멤버도 취소됨
        related_members = artist.members.all() 
        for member in related_members:
            other_followed_artists = member.artist_name.exclude(id=artist.id).filter(followers=request.user)

            if not other_followed_artists.exists():
                member.followers.remove(request.user)
    else:
        artist.followers.add(request.user)
    return redirect(request.META.get('HTTP_REFERER', '/'))

# 자동완성용 JSON 응답
# @require_GET
# def autocomplete(request):
#     q = request.GET.get('q', '').strip()
#     if q:
#         artists = Artist.objects.filter(
#             Q(display_name__icontains=q) |
#             Q(korean_name__icontains=q) |
#             Q(english_name__icontains=q) |
#             Q(alias__icontains=q)
#         ).values_list('display_name', flat=True)[:10]
#     else:
#         artists = []

#     return JsonResponse({'results': list(artists)})
# artist/views.py - 솔로 아티스트 중복 제거

@require_GET
def autocomplete(request):
    """아티스트 + 멤버 통합 자동완성 (솔로 아티스트 중복 제거)"""
    q = request.GET.get('q', '').strip()
    results = []
    seen_names = set()  # 이름 기반 중복 제거
    
    if q:
        # 🎵 Artist 검색 (alias 포함)
        artists = Artist.objects.filter(
            Q(display_name__icontains=q) |
            Q(korean_name__icontains=q) |
            Q(english_name__icontains=q) |
            Q(alias__icontains=q)
        )[:8]
        
        for artist in artists:
            name_key = artist.display_name.lower()
            if name_key not in seen_names:
                results.append({
                    'type': 'artist',
                    'name': artist.display_name,
                    'artist': artist.display_name,
                    'artist_id': artist.id,
                    'member_id': None,
                    'birthday': None,
                    'is_solo': getattr(artist, 'is_solo', False)
                })
                seen_names.add(name_key)
        
        # 👤 Member 검색 (솔로 아티스트와 중복되지 않도록)
        members = Member.objects.filter(
            member_name__icontains=q
        ).prefetch_related('artist_name')[:20]  # 더 많이 가져와서 중복 처리
        
        member_entries = {}  # 각 멤버(ID별)를 개별 관리
        
        for member in members:
            member_name_key = member.member_name.lower()
            
            # 이미 Artist로 추가된 이름이면 건너뛰기 (솔로 아티스트와 중복 방지)
            if member_name_key in seen_names:
                continue
                
            artist_groups = member.artist_name.all()
            
            if artist_groups:
                # 각 멤버를 ID로 구분 (동명이인 구분)
                member_unique_key = f"{member_name_key}_{member.id}"
                
                if member_unique_key not in member_entries:
                    member_entries[member_unique_key] = {
                        'name': member.member_name,
                        'member_id': member.id,
                        'birthday': getattr(member, 'member_bday', None),
                        'all_artists': []
                    }
                
                # 현재 멤버의 모든 아티스트 추가 (동일 멤버의 여러 그룹 소속)
                for artist in artist_groups:
                    if artist.display_name not in [a['name'] for a in member_entries[member_unique_key]['all_artists']]:
                        member_entries[member_unique_key]['all_artists'].append({
                            'name': artist.display_name,
                            'id': artist.id
                        })
        
        # 멤버 결과 추가 (동명이인은 각각 별도로 표시)
        for member_unique_key, member_data in member_entries.items():
            if len(results) >= 16:  # 전체 결과 수 제한
                break
                
            # 모든 소속 그룹명 표시
            artist_display = ' / '.join([a['name'] for a in member_data['all_artists']])
            # 대표 아티스트 ID (첫 번째 아티스트)
            representative_artist_id = member_data['all_artists'][0]['id'] if member_data['all_artists'] else None
            
            results.append({
                'type': 'member',
                'name': member_data['name'],
                'artist': artist_display,
                'artist_id': representative_artist_id,
                'member_id': member_data['member_id'],
                'birthday': member_data['birthday'],
                'is_solo': False
            })
            # seen_names에는 실제 이름만 추가 (솔로 아티스트와 중복 방지용)
    
    return JsonResponse({'results': results})



@require_GET
def artist_only_autocomplete(request):
    """아티스트만 검색하는 자동완성 (artist/ 페이지용)"""
    q = request.GET.get('q', '').strip()
    results = []
    
    if q:
        # 🎵 Artist만 검색 (alias 포함)
        artists = Artist.objects.filter(
            Q(display_name__icontains=q) |
            Q(korean_name__icontains=q) |
            Q(english_name__icontains=q) |
            Q(alias__icontains=q)
        )[:10]
        
        for artist in artists:
            results.append({
                'type': 'artist',
                'name': artist.display_name,
                'artist': artist.display_name,
                'artist_id': artist.id,
                'member_id': None,
                'birthday': None,
                'is_solo': getattr(artist, 'is_solo', False)
            })
    
    return JsonResponse({'results': results})

# 1. 아티스트 멤버 리스트 Ajax로 렌더링
def artist_members_ajax(request, artist_id):
    artist = get_object_or_404(Artist, id=artist_id)
    members = artist.members.all()
    html = render_to_string('components/_member_list.html', {
        'artist': artist,
        'members': members,
        'user': request.user,
    })
    return JsonResponse({'html': html})

# 2. 멤버 팔로우/언팔로우 Ajax 처리
@login_required
def follow_member_ajax(request, member_id):
    member = get_object_or_404(Member, id=member_id)
    user = request.user
    followed = False

    if user in member.followers.all():
        member.followers.remove(user)
    else:
        member.followers.add(user)
        followed = True

    return JsonResponse({'followed': followed})

# 모달 멤버 출력용
def get_artist_members(request, artist_id):
    artist = get_object_or_404(Artist, id=artist_id)
    members = artist.members.all()

    html = render_to_string('components/_member_list.html', {
        'artist': artist,
        'members': members,
        'user': request.user,
    })

    return JsonResponse({'html': html})

@require_GET
def member_autocomplete(request):
    q = request.GET.get('q', '').strip()
    results = []

    if q:
        members = Member.objects.filter(
            Q(member_name__icontains=q)
        ).prefetch_related('artist_name')[:10]

        for member in members:
            artist_names = member.artist_name.all()
            if artist_names:
                artist = artist_names[0]  # 대표 아티스트 1개만
                artist_display = ' / '.join([a.display_name for a in artist_names])

                results.append({
                    'member_id': member.id,
                    'artist_id': artist.id,
                    'member_name': member.member_name,
                    'artist_display': artist_display,
                    'bday': member.member_bday,
                })

    return JsonResponse({'results': results})