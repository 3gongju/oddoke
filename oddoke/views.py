# from django.shortcuts import render

# def main(request):
#     return render(request, 'main/home.html')

from django.shortcuts import render
from artist.models import Artist  # 찜한 아티스트 정보를 위해 필요

# def main(request):
#     favourite_artists = []
#     if request.user.is_authenticated:
#         favourite_artists = Artist.objects.filter(followers=request.user)

#     return render(request, 'main/home.html', {
#         'favourite_artists': favourite_artists,
#     })

def main(request):
    favourite_artists = []
    if request.user.is_authenticated:
        favourite_artists = Artist.objects.filter(followers=request.user)

    banner_images = [
        # 'image/banner/banner_basic.png',  # ← 배경 기본 배너
        # 'image/banner/banner_basic1.png',  # ← 배경 기본 배너
        'image/banner/banner_basic2.png',
        
        'image/banner/banner1.jpg',
        'image/banner/banner2.jpg',
        'image/banner/banner3.jpg',
        'image/banner/banner4.jpg',
    ]

    return render(request, 'main/home.html', {
        'favourite_artists': favourite_artists,
        'banner_images': banner_images,
    })
