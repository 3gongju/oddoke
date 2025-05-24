from itertools import zip_longest
from django.shortcuts import render
from artist.models import Artist

def group_artists(artists, group_size=5):
    """리스트를 group_size씩 묶고 None 제거"""
    return [list(filter(None, group)) for group in zip_longest(*[iter(artists)] * group_size)]

def main(request):
    favourite_artists = []

    if request.user.is_authenticated:
        favourite_artists = list(Artist.objects.filter(followers=request.user))

    # ✅ 5개 미만이면 dummy 아티스트 추가 (id=None 포함)
    max_count = 5
    if len(favourite_artists) < max_count:
        empty_slots = max_count - len(favourite_artists)
        for _ in range(empty_slots):
            favourite_artists.append({
                'id': None,  # 반드시 필요
                'logo': 'image/ddok_black.png',
                'display_name': ''
            })

    grouped_artists = group_artists(favourite_artists)

    banner_images = [
        'image/banner/banner_basic2.png',
        'image/banner/banner1.jpg',
        'image/banner/banner2.jpg',
        'image/banner/banner3.jpg',
        'image/banner/banner4.jpg',
    ]

    return render(request, 'main/home.html', {
        'banner_images': banner_images,
        'grouped_artists': grouped_artists,
    })
