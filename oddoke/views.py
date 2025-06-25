from itertools import zip_longest, chain
from datetime import datetime, timedelta
from django.shortcuts import render
from django.db.models import Count, Q
from artist.models import Artist, Member
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost
from ddoksang.utils.bday_utils import get_weekly_bday_artists
from accounts.models import BannerRequest


def group_artists(artists, group_size=5):
    return [list(filter(None, group)) for group in zip_longest(*[iter(artists)] * group_size)]

def intro_view(request):
    """어덕해 소개 페이지 - 17개 슬라이드로 구성된 랜딩 페이지"""

    # 기본 이미지 경로 정의
    DEFAULT_SLIDE_IMAGE = 'image/slide/intro_slide_default.jpg'
    
    # 각 슬라이드별 콘텐츠 정보 정의
    slide_contents = [
        {
            'title': '어덕해에 오신 것을 환영합니다',
            'subtitle': '팬들을 위한 특별한 공간',
            'description': '덕질의 모든 것을 경험하세요',
            'type': 'welcome',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '덕팜 - 굿즈 거래의 새로운 방식',
            'subtitle': '안전하고 편리한 거래',
            'description': '판매, 대여, 공동구매까지 모든 거래를 한 곳에서',
            'type': 'ddokfarm',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '덕담 - 팬들만의 소통 공간',
            'subtitle': '자유로운 소통과 정보 공유',
            'description': '커뮤니티, 매너샷, 생일카페 정보까지',
            'type': 'ddokdam',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '덕생 - 아티스트 생일 달력',
            'subtitle': '소중한 순간을 놓치지 마세요',
            'description': '생일 알림과 기념 이벤트 정보',
            'type': 'ddoksang',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '덕채팅 - 실시간 소통',
            'subtitle': '팬들과의 즉석 대화',
            'description': '같은 관심사를 가진 사람들과 실시간으로 소통하세요',
            'type': 'ddokchat',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '안전한 거래 환경',
            'subtitle': '신뢰할 수 있는 플랫폼',
            'description': '검증된 사용자들과 안전하게 거래하세요',
            'type': 'safety',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '다양한 아티스트 지원',
            'subtitle': 'K-POP부터 일본 아티스트까지',
            'description': '모든 장르의 아티스트 팬들을 위한 공간',
            'type': 'artists',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '모바일 최적화',
            'subtitle': '언제 어디서나 편리하게',
            'description': '모바일에서도 완벽한 사용자 경험',
            'type': 'mobile',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '커뮤니티 기능',
            'subtitle': '팬들과 함께 만드는 문화',
            'description': '후기, 리뷰, 정보 공유로 더 풍부한 덕질',
            'type': 'community',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '이벤트 & 혜택',
            'subtitle': '특별한 혜택과 이벤트',
            'description': '정기적인 이벤트와 회원 전용 혜택',
            'type': 'events',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '24/7 고객 지원',
            'subtitle': '언제든 도움을 받으세요',
            'description': '빠른 문의 응답과 친절한 고객 서비스',
            'type': 'support'
        },
        {
            'title': '개인정보 보호',
            'subtitle': '안전한 개인정보 관리',
            'description': '철저한 보안으로 개인정보를 보호합니다',
            'type': 'privacy',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '글로벌 서비스',
            'subtitle': '전 세계 팬들과 연결',
            'description': '국경을 넘나드는 팬 문화 교류',
            'type': 'global',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': 'AI 추천 시스템',
            'subtitle': '맞춤형 콘텐츠 추천',
            'description': '취향에 맞는 굿즈와 정보를 추천받으세요',
            'type': 'ai',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '실시간 알림',
            'subtitle': '중요한 소식을 놓치지 마세요',
            'description': '관심 아티스트의 새로운 소식을 실시간으로',
            'type': 'notifications',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '팬클럽 연동',
            'subtitle': '공식 팬클럽과의 연계',
            'description': '공식 정보와 이벤트를 한 번에',
            'type': 'fanclub',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '지금 시작하세요',
            'subtitle': '새로운 덕질의 시작',
            'description': '어덕해와 함께 더 풍부한 팬 라이프를 경험하세요',
            'type': 'cta',
            'image': DEFAULT_SLIDE_IMAGE
        }
    ]
    
    # 통계 정보 (선택적)
    stats = {
        'total_users': 0,
        'total_posts': 0,
        'total_artists': 0,
        'total_trades': 0
    }
    
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        stats['total_users'] = User.objects.count()
        stats['total_artists'] = Artist.objects.count()
        
        # 전체 게시물 수 계산
        farm_posts = (FarmSellPost.objects.count() + 
                     FarmRentalPost.objects.count() + 
                     FarmSplitPost.objects.count())
        dam_posts = (DamCommunityPost.objects.count() + 
                    DamMannerPost.objects.count() + 
                    DamBdaycafePost.objects.count())
        stats['total_posts'] = farm_posts + dam_posts
        stats['total_trades'] = farm_posts
        
    except Exception as e:
        print(f"통계 정보 로드 오류: {e}")
    
    context = {
        'page_title': '어덕해 소개',
        'total_slides': 17,  # 17개 슬라이드로 변경
        'slide_contents': slide_contents,
        'stats': stats,
    }
    return render(request, 'main/intro.html', context)


def main(request):
    # 기존 main 뷰 코드는 그대로 유지
    # 1) 찜한 아티스트 원본 목록
    raw_favs = list(Artist.objects.filter(followers=request.user)) if request.user.is_authenticated else []

    # 2) 그룹별 페이징 캐러셀을 위한 5개씩 묶기
    grouped_artists = group_artists(raw_favs) if raw_favs else []

    # 3) 배너 이미지 리스트 (사용자 배너 + 기본 배너)
    user_banners = get_active_user_banners()
    
    # 기본 배너 이미지들
    default_banner_images = [
        'image/banner/banner1.jpg',
        'image/banner/banner2.jpg',
        'image/banner/banner3.jpg',
        'image/banner/banner4.jpg',
    ]
    
    # 사용자 배너와 기본 배너 합치기
    banner_images = user_banners + default_banner_images

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

def get_active_user_banners():
    """활성화된 사용자 배너들을 가져오기"""
    try:
        from django.utils import timezone
        
        today = timezone.now().date()
        
        # 🔥 수정된 필터링 조건
        active_banners = BannerRequest.objects.filter(
            status='approved',
            is_active=True,
            start_date__lte=today,
            end_date__gte=today
        ).order_by('-approved_at')
        
        print(f"🔥 DEBUG: 활성 배너 조회 결과 - {active_banners.count()}개")
        
        # 이미지 URL들을 반환
        user_banner_urls = []
        for banner in active_banners:
            if banner.banner_image:
                print(f"🔥 DEBUG: 배너 추가 - {banner.artist_name}, {banner.banner_image.url}")
                user_banner_urls.append(banner.banner_image.url)
        
        print(f"🔥 DEBUG: 최종 배너 URL 개수 - {len(user_banner_urls)}개")
        return user_banner_urls
        
    except Exception as e:
        print(f"🔥 DEBUG: 사용자 배너 로드 오류: {e}")
        return []