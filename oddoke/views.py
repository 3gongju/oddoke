from itertools import zip_longest, chain
from datetime import datetime, timedelta
from django.shortcuts import render
from django.db.models import Count, Q
from artist.models import Artist, Member
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost
from ddoksang.utils.bday_utils import get_weekly_bday_artists


def group_artists(artists, group_size=5):
    return [list(filter(None, group)) for group in zip_longest(*[iter(artists)] * group_size)]

def intro_view(request):
    """어덕해 소개 페이지"""
    context = {
        'page_title': '어덕해 소개',
        'total_slides': 10,  # 슬라이드 개수
    }
    return render(request, 'main/intro.html', context)


def main(request):
    # 1) 찜한 아티스트 원본 목록
    raw_favs = list(Artist.objects.filter(followers=request.user)) if request.user.is_authenticated else []

    # 2) 그룹별 페이징 캐러셀을 위한 5개씩 묶기
    grouped_artists = group_artists(raw_favs) if raw_favs else []

    # 3) 배너 이미지 리스트
    banner_images = [
        'image/banner/banner1.jpg',
        'image/banner/banner2.jpg',
        'image/banner/banner3.jpg',
        'image/banner/banner4.jpg',
    ]

    # 4) 덕팜 최신 게시물들 - 각 카테고리별로 가져온 후 통합
    sell_posts = list(FarmSellPost.objects.order_by('-created_at')[:10])
    for post in sell_posts:
        post.category = 'sell'

    rental_posts = list(FarmRentalPost.objects.order_by('-created_at')[:10])
    for post in rental_posts:
        post.category = 'rental'

    split_posts = list(FarmSplitPost.objects.order_by('-created_at')[:10])
    for post in split_posts:
        post.category = 'split'

    # 템플릿용 통합 덕팜 데이터 (모든 카테고리 합쳐서 최신순 정렬)
    latest_sell_posts = sorted(
        chain(sell_posts, rental_posts, split_posts),
        key=lambda x: x.created_at,
        reverse=True
    )

    # 5) 덕담 최신 게시물들 - 각 카테고리별로 가져온 후 통합
    community_posts = list(DamCommunityPost.objects.order_by('-created_at')[:10])
    for post in community_posts:
        post.category = 'community'

    manner_posts = list(DamMannerPost.objects.order_by('-created_at')[:10])
    for post in manner_posts:
        post.category = 'manner'

    bdaycafe_posts = list(DamBdaycafePost.objects.order_by('-created_at')[:10])
    for post in bdaycafe_posts:
        post.category = 'bdaycafe'

    # 템플릿용 통합 덕담 데이터 (모든 카테고리 합쳐서 최신순 정렬)
    latest_community_posts = sorted(
        chain(community_posts, manner_posts, bdaycafe_posts),
        key=lambda x: x.created_at,
        reverse=True
    )

    # 6) 새로 추가: 이주의 베스트 (좋아요 수 기준)
    # 일주일 전 날짜 계산
    one_week_ago = datetime.now() - timedelta(days=7)
    
    # 모든 게시물을 합쳐서 좋아요 수 기준으로 정렬
    weekly_best_posts = []
    
    # 덕팜 게시물들 (좋아요 수가 있다면)
    if hasattr(FarmSellPost, 'like'):  # 좋아요 기능이 있는 경우
        best_sell_posts = list(FarmSellPost.objects
                         .filter(created_at__gte=one_week_ago)
                         .annotate(like_count=Count('like'))
                         .order_by('-like_count')[:3])
        for post in best_sell_posts:
            post.category = 'sell'
        weekly_best_posts.extend(best_sell_posts)
    
    # 덕담 게시물들
    if hasattr(DamCommunityPost, 'like'):  # 좋아요 기능이 있는 경우
        best_community_posts = list(DamCommunityPost.objects
                              .filter(created_at__gte=one_week_ago)
                              .annotate(like_count=Count('like'))
                              .order_by('-like_count')[:3])
        for post in best_community_posts:
            post.category = 'community'
        weekly_best_posts.extend(best_community_posts)
    
    # 좋아요 기능이 없다면 조회수나 최신순으로 대체
    if not weekly_best_posts:
        # 조회수 기준 (view_count 필드가 있다면)
        if hasattr(FarmSellPost, 'view_count'):
            best_sell_posts = list(FarmSellPost.objects
                             .filter(created_at__gte=one_week_ago)
                             .order_by('-view_count')[:4])
            for post in best_sell_posts:
                post.category = 'sell'
            weekly_best_posts.extend(best_sell_posts)
        
        if hasattr(DamCommunityPost, 'view_count'):
            best_community_posts = list(DamCommunityPost.objects
                                  .filter(created_at__gte=one_week_ago)
                                  .order_by('-view_count')[:4])
            for post in best_community_posts:
                post.category = 'community'
            weekly_best_posts.extend(best_community_posts)
    
    # 그래도 없다면 최신순으로 대체
    if not weekly_best_posts:
        recent_sell = list(FarmSellPost.objects.order_by('-created_at')[:4])
        for post in recent_sell:
            post.category = 'sell'
        recent_community = list(DamCommunityPost.objects.order_by('-created_at')[:4])
        for post in recent_community:
            post.category = 'community'
        weekly_best_posts = recent_sell + recent_community

    # 7) 주간 생일 멤버
    birthday_artists = get_weekly_bday_artists()

    return render(request, 'main/home.html', {
        'raw_favs': raw_favs,
        'grouped_artists': grouped_artists,
        'banner_images': banner_images,

        # 템플릿에서 사용할 통합된 데이터 (중요!)
        'latest_sell_posts': latest_sell_posts,           # 덕팜 전체 통합
        'latest_community_posts': latest_community_posts, # 덕담 전체 통합
        
        # 개별 카테고리 데이터 (기존 코드 호환성 유지)
        'latest_rental_posts': rental_posts,
        'latest_split_posts': split_posts,
        'latest_manner_posts': manner_posts,
        'latest_bdaycafe_posts': bdaycafe_posts,
        
        # 새로 추가된 변수
        'weekly_best_posts': weekly_best_posts,
        
        'birthday_artists': birthday_artists,
    })