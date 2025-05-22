from django.shortcuts import render, get_object_or_404, redirect
from .models import Artist
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.db.models import Q

# 아티스트 목록 + 검색 필터
def index(request):
    query = request.GET.get('q', '')
    if query:
        artists = Artist.objects.filter(
            Q(display_name__icontains=query) |
            Q(korean_name__icontains=query) |
            Q(english_name__icontains=query) |
            Q(alias__icontains=query)
        ).order_by('id')
    else:
        artists = Artist.objects.all().order_by('id')

    return render(request, 'artist/index.html', {
        'artists': artists,
        'query': query,
    })

# 찜 토글
@login_required
def toggle_favourite(request, artist_id):
    artist = get_object_or_404(Artist, id=artist_id)
    if request.user in artist.followers.all():
        artist.followers.remove(request.user)
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
