from itertools import zip_longest
from datetime import datetime, timedelta
from django.shortcuts import render
from artist.models import Artist, Member
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost


def group_artists(artists, group_size=5):
    return [list(filter(None, group)) for group in zip_longest(*[iter(artists)] * group_size)]


# def get_weekly_birthdays():
#     today = datetime.today()
#     start_of_week = today - timedelta(days=today.weekday())  # 이번 주 월요일
#     end_of_week = start_of_week + timedelta(days=6)          # 이번 주 일요일

#     def to_date(mmdd_str):
#         try:
#             return datetime.strptime(f"{today.year}-{mmdd_str}", "%Y-%m-%d")
#         except:
#             return None

#     members = Member.objects.exclude(member_bday__isnull=True).exclude(member_bday__exact='')
#     birthday_list = []
#     for m in members:
#         bday_date = to_date(m.member_bday)
#         if bday_date and start_of_week <= bday_date <= end_of_week:
#             artist_names = ', '.join([a.display_name for a in m.artist_name.all()])
#             birthday_list.append({
#                 'member_name': m.member_name,
#                 'artist_name': artist_names,
#                 'bday': bday_date.strftime('%m월 %d일'),
#             })
#     return birthday_list


def main(request):
    # 1) 찜한 아티스트 원본 목록
    raw_favs = list(Artist.objects.filter(followers=request.user)) if request.user.is_authenticated else []

    # 2) 그룹별 페이징 캐러셀을 위한 5개씩 묶기
    grouped_artists = group_artists(raw_favs) if raw_favs else []

    # 3) 배너 이미지 리스트
    banner_images = [
        'image/banner/banner_basic2.png',
        'image/banner/banner1.jpg',
        'image/banner/banner2.jpg',
        'image/banner/banner3.jpg',
        'image/banner/banner4.jpg',
    ]

    # 4) 덕팜 최신 게시물 3개 + 카테고리 수동 부여
    latest_sell_posts = list(FarmSellPost.objects.order_by('-created_at')[:3])
    for post in latest_sell_posts:
        post.category = 'sell'

    latest_rental_posts = list(FarmRentalPost.objects.order_by('-created_at')[:3])
    for post in latest_rental_posts:
        post.category = 'rental'

    latest_split_posts = list(FarmSplitPost.objects.order_by('-created_at')[:3])
    for post in latest_split_posts:
        post.category = 'split'

    # 5) 덕담 최신 게시물 3개 + 카테고리 수동 부여
    latest_community_posts = list(DamCommunityPost.objects.order_by('-created_at')[:3])
    for post in latest_community_posts:
        post.category = 'community'

    latest_manner_posts = list(DamMannerPost.objects.order_by('-created_at')[:3])
    for post in latest_manner_posts:
        post.category = 'manner'

    latest_bdaycafe_posts = list(DamBdaycafePost.objects.order_by('-created_at')[:3])
    for post in latest_bdaycafe_posts:
        post.category = 'bdaycafe'

    # 6) 주간 생일 멤버

    return render(request, 'main/home.html', {
        'raw_favs': raw_favs,
        'grouped_artists': grouped_artists,
        'banner_images': banner_images,

        'latest_sell_posts': latest_sell_posts,
        'latest_rental_posts': latest_rental_posts,
        'latest_split_posts': latest_split_posts,

        'latest_community_posts': latest_community_posts,
        'latest_manner_posts': latest_manner_posts,
        'latest_bdaycafe_posts': latest_bdaycafe_posts,

    })
