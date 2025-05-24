# from django.shortcuts import render

# def main(request):
#     return render(request, 'main/home.html')
from itertools import zip_longest
from django.shortcuts import render
from artist.models import Artist
  # Artist 모델 import

def group_artists(artists, group_size=5):
    """리스트를 group_size씩 묶어서 None은 제거"""
    return [list(filter(None, group)) for group in zip_longest(*[iter(artists)] * group_size)]

def main(request):
    favourite_artists = []
    if request.user.is_authenticated:
        favourite_artists = list(Artist.objects.filter(followers=request.user))

    # ✨ 5개 미만일 경우 빈 로고로 패딩
    max_count = 5
    if len(favourite_artists) < max_count:
        empty_slots = max_count - len(favourite_artists)
        for _ in range(empty_slots):
            favourite_artists.append({
                'logo': 'image/ddok_logo.png',
                'display_name': ''
            })

    # ✅ 5개씩 그룹화
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
