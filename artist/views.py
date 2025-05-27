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
@require_GET
def autocomplete(request):
    q = request.GET.get('q', '').strip()
    if q:
        artists = Artist.objects.filter(
            Q(display_name__icontains=q) |
            Q(korean_name__icontains=q) |
            Q(english_name__icontains=q) |
            Q(alias__icontains=q)
        ).values_list('display_name', flat=True)[:10]
    else:
        artists = []

    return JsonResponse({'results': list(artists)})

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