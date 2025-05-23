# from django.shortcuts import render

# def main(request):
#     return render(request, 'main/home.html')

from django.shortcuts import render
from artist.models import Artist  # 찜한 아티스트 정보를 위해 필요

def main(request):
    favourite_artists = []
    if request.user.is_authenticated:
        favourite_artists = Artist.objects.filter(followers=request.user)

    return render(request, 'main/home.html', {
        'favourite_artists': favourite_artists,
    })
