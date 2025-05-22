from django.shortcuts import render, redirect
from .models import Artist

# Create your views here.

# 아이돌 선택 화면
def index(request):
    # artists = Artist.objects.all().order_by('?')  # 랜덤 순서로 출력
    artists = Artist.objects.all().order_by('id')  # ID 순서로 출력
    context = {
        'artists': artists
    }
    return render(request, 'artist/index.html', context)