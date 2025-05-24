# grouped_artists, 배너 이미지, 그리고 6개 카테고리별 게시글 리스트를 전달
from itertools import zip_longest
from django.shortcuts import render
from artist.models import Artist
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost

def group_artists(artists, group_size=5):
    return [list(filter(None, group)) for group in zip_longest(*[iter(artists)] * group_size)]

def main(request):
    # 찜한 아티스트
    favourite_artists = []
    if request.user.is_authenticated:
        favourite_artists = list(Artist.objects.filter(followers=request.user))

    all_artists = Artist.objects.all()
    favourite_ids = [artist.id for artist in favourite_artists if hasattr(artist, 'id')]
    other_artists = all_artists.exclude(id__in=favourite_ids)

    # 찜한 아티스트가 5개 미만이면 빈 슬롯 추가
    max_count = 5
    if len(favourite_artists) < max_count:
        empty_slots = max_count - len(favourite_artists)
        for _ in range(empty_slots):
            favourite_artists.append({
                'id': None,
                'logo': 'image/ddok_black.png',
                'display_name': ''
            })

    grouped_artists = group_artists(favourite_artists)

    # 배너 이미지 경로
    banner_images = [
        'image/banner/banner_basic2.png',
        'image/banner/banner1.jpg',
        'image/banner/banner2.jpg',
        'image/banner/banner3.jpg',
        'image/banner/banner4.jpg',
    ]

    # ✅ 덕팜 게시글 (각 게시글에 category 수동 부여)
    latest_sell_posts = list(FarmSellPost.objects.order_by('-created_at')[:3])
    for post in latest_sell_posts:
        post.category = 'sell'

    latest_rental_posts = list(FarmRentalPost.objects.order_by('-created_at')[:3])
    for post in latest_rental_posts:
        post.category = 'rental'

    latest_split_posts = list(FarmSplitPost.objects.order_by('-created_at')[:3])
    for post in latest_split_posts:
        post.category = 'split'

    # ✅ 덕담 게시글 (각 게시글에 category 수동 부여)
    latest_community_posts = list(DamCommunityPost.objects.order_by('-created_at')[:3])
    for post in latest_community_posts:
        post.category = 'community'

    latest_manner_posts = list(DamMannerPost.objects.order_by('-created_at')[:3])
    for post in latest_manner_posts:
        post.category = 'manner'

    latest_bdaycafe_posts = list(DamBdaycafePost.objects.order_by('-created_at')[:3])
    for post in latest_bdaycafe_posts:
        post.category = 'bdaycafe'

    return render(request, 'main/home.html', {
        'banner_images': banner_images,
        'grouped_artists': grouped_artists,
        'other_artists': other_artists,

        'latest_sell_posts': latest_sell_posts,
        'latest_rental_posts': latest_rental_posts,
        'latest_split_posts': latest_split_posts,

        'latest_community_posts': latest_community_posts,
        'latest_manner_posts': latest_manner_posts,
        'latest_bdaycafe_posts': latest_bdaycafe_posts,
    })
