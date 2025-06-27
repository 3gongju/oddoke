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
    """어덕해 소개 페이지 - 18개 슬라이드로 구성된 랜딩 페이지"""

    # 기본 이미지 경로 정의
    DEFAULT_SLIDE_IMAGE = 'image/slide/intro_slide_default.jpg'
    
    # 실제 데이터 가져오기
    try:
        # 찜한 아티스트 데이터 추가
        raw_favs = list(Artist.objects.filter(followers=request.user)) if request.user.is_authenticated else []
        
        # 덕생 - 생일 아티스트 데이터 (개선된 버전)
        birthday_artists = get_weekly_bday_artists()
        
        # 추가 생일 관련 데이터 수집
        try:
            from django.utils import timezone
            import calendar
            
            current_date = timezone.now()
            current_month = current_date.month
            current_year = current_date.year
            
            # 이번 달 생일 멤버들 추가 조회
            monthly_birthday_count = 0
            upcoming_birthdays = []
            
            # Member 모델에서 이번 달 생일인 멤버들 조회
            for artist in Artist.objects.prefetch_related('members'):
                for member in artist.members.all():
                    if hasattr(member, 'birthday') and member.birthday:
                        if member.birthday.month == current_month:
                            monthly_birthday_count += 1
                            # 다가오는 생일 (오늘 이후) 추가
                            if member.birthday.day >= current_date.day:
                                upcoming_birthdays.append({
                                    'member_name': member.name,
                                    'artist_name': artist.display_name,
                                    'artist_display_name': artist.display_name,
                                    'birthday': member.birthday,
                                    'days_until': (member.birthday.replace(year=current_year) - current_date.date()).days,
                                    'is_today': member.birthday.day == current_date.day,
                                })
            
            # 날짜순으로 정렬
            upcoming_birthdays.sort(key=lambda x: x['days_until'])
            
            # birthday_artists에 추가 정보 포함
            for artist in birthday_artists:
                # 오늘이 생일인지 확인
                if hasattr(artist, 'birthday') and artist.birthday:
                    artist.is_today_birthday = artist.birthday.day == current_date.day and artist.birthday.month == current_month
                else:
                    artist.is_today_birthday = False
                
                # 생일 표시 형식 추가
                if hasattr(artist, 'birthday') and artist.birthday:
                    artist.birthday_display = f"{artist.birthday.month:02d}-{artist.birthday.day:02d}"
                else:
                    artist.birthday_display = "정보 없음"
            
            # 생일 통계 정보 추가
            birthday_stats = {
                'weekly_count': len(birthday_artists),
                'monthly_count': monthly_birthday_count,
                'upcoming_count': len([b for b in upcoming_birthdays if b['days_until'] > 0]),
                'today_count': len([b for b in upcoming_birthdays if b['is_today']]),
                'upcoming_birthdays': upcoming_birthdays[:5]  # 가장 가까운 5개만
            }
            
        except Exception as e:
            birthday_stats = {
                'weekly_count': len(birthday_artists),
                'monthly_count': 0,
                'upcoming_count': 0,
                'today_count': 0,
                'upcoming_birthdays': []
            }
        
        # 최신 덕팜 게시물 (실제 데이터)
        latest_ddokfarm_posts = []
        sell_posts = list(FarmSellPost.objects.select_related('user').prefetch_related('images').order_by('-created_at')[:3])
        for post in sell_posts:
            post.category = 'sell'
            latest_ddokfarm_posts.append(post)
        
        # 최신 덕담 게시물 (실제 데이터)
        latest_ddokdam_posts = []
        community_posts = list(DamCommunityPost.objects.select_related('user').prefetch_related('images').order_by('-created_at')[:3])
        for post in community_posts:
            post.category = 'community'
            latest_ddokdam_posts.append(post)
            
    except Exception as e:
        raw_favs = []
        birthday_artists = []
        latest_ddokfarm_posts = []
        latest_ddokdam_posts = []
        birthday_stats = {
            'weekly_count': 0,
            'monthly_count': 0,
            'upcoming_count': 0,
            'today_count': 0,
            'upcoming_birthdays': []
        }
    
    # 각 슬라이드별 콘텐츠 정보 정의 (18개 슬라이드)
    slide_contents = [
        {
            'title': '어덕해',
            'subtitle': '어떻게? 어떡해!',
            'description': '덕질 종합 플랫폼',
            'type': 'welcome',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '덕팜 - 굿즈 거래의 새로운 방식',
            'subtitle': '안전하고 편리한 거래',
            'description': '양도, 대여, 분철까지 모든 거래를 한 곳에서',
            'type': 'ddokfarm',
            'image': DEFAULT_SLIDE_IMAGE,
            'real_data': latest_ddokfarm_posts
        },
        {
            'title': '덕담 - 팬들만의 소통 공간',
            'subtitle': '자유로운 소통과 정보 공유',
            'description': '커뮤니티, 예절샷, 생일카페 후기까지',
            'type': 'ddokdam',
            'image': DEFAULT_SLIDE_IMAGE,
            'real_data': latest_ddokdam_posts
        },
        {
            'title': '덕생 - 아티스트 생일 캘린더',
            'subtitle': '생일을 함께 축하해요!',
            'description': '이번주의 생일을 확인하고, 생일을 축하하며, 덕을 쌓아요.',
            'type': 'ddoksang',
            'image': DEFAULT_SLIDE_IMAGE,
            'real_data': birthday_artists,
            'stats_data': birthday_stats
        },
        {
            'title': '덕챗 - 팬과 팬을 잇는 대화',
            'subtitle': '실시간 채팅으로 더 편하게',
            'description': '굿즈 거래를 안전하게, 실시간 채팅으로',
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
            'subtitle': '모든 덕들을 위한 플랫폼',
            'description': 'K-POP 팬들을 위한 맞춤형 공간',
            'type': 'artists',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '웹 최적화',
            'subtitle': '큰 화면으로 크게 덕질 즐기자!',
            'description': '조만간 모바일에서도 즐길 수 있어요!',
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
            'description': '정기적인 이벤트와 어덕해 주민들 전용 혜택 IS COMING SOON',
            'type': 'events',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '24/7 고객 지원',
            'subtitle': '언제든 도움을 받으세요',
            'description': '빠른 문의 응답과 친절한 고객 서비스',
            'type': 'support',
            'image': DEFAULT_SLIDE_IMAGE
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
            'description': '(ENGLISH VERSION IS 커밍쑨)',
            'type': 'global',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '찜한 아티스트 모아보기',
            'subtitle': '맞춤형 콘텐츠 추천',
            'description': '취향에 맞는 굿즈와 정보를 쉽게 찾기',
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
            'title': '찜한 아티스트',
            'subtitle': '내가 좋아하는 아티스트들',
            'description': '찜한 아티스트들의 최신 소식을 놓치지 마세요',
            'type': 'favorite_artists',
            'image': DEFAULT_SLIDE_IMAGE,
            'real_data': raw_favs
        },
        {
            'title': '지금 시작하세요',
            'subtitle': '새로운 덕질의 시작',
            'description': '어덕해와 함께 더 풍부한 팬 라이프를 경험하세요',
            'type': 'cta',
            'image': DEFAULT_SLIDE_IMAGE
        }
    ]
    
    # 통계 정보 (실제 데이터로 계산)
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
        pass
    
    context = {
        'page_title': '어덕해 소개',
        'total_slides': 18,
        'slide_contents': slide_contents,
        'stats': stats,
        'raw_favs': raw_favs,
        'birthday_artists': birthday_artists,
        'birthday_stats': birthday_stats,
        'latest_ddokfarm_posts': latest_ddokfarm_posts,
        'latest_ddokdam_posts': latest_ddokdam_posts,
    }
    return render(request, 'main/intro.html', context)


def main(request):
    # 1) 찜한 아티스트 원본 목록
    raw_favs = list(Artist.objects.filter(followers=request.user)) if request.user.is_authenticated else []

    # 2) 그룹별 페이징 캐러셀을 위한 5개씩 묶기
    grouped_artists = group_artists(raw_favs) if raw_favs else []

    # 3) 수정된 배너 관련 로직 - 활성 배너 정보도 함께 전달
    user_banners, active_banner = get_active_user_banners_with_info()
    
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
        'active_banner': active_banner,

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


def get_active_user_banners_with_info():
    """새로운 함수: 활성화된 사용자 배너들과 배너 정보를 함께 가져오기"""
    try:
        from django.utils import timezone
        
        today = timezone.now().date()
        now = timezone.now()
        
        # 개선된 활성화된 배너들 조회 (날짜와 시간 둘 다 체크)
        active_banners = BannerRequest.objects.filter(
            status='approved',
            is_active=True,
            start_date__lte=today,
            end_date__gte=today
        ).select_related('user').order_by('-approved_at')
        
        # 추가: expires_at도 체크 (있는 경우)
        if active_banners.exists():
            active_banners = active_banners.filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=now)
            )
        
        # 이미지 URL들과 첫 번째 활성 배너 정보를 반환
        user_banner_urls = []
        first_active_banner = None
        
        for banner in active_banners:
            if banner.banner_image:
                user_banner_urls.append(banner.banner_image.url)
                
                # 첫 번째 배너를 대표 배너로 설정
                if first_active_banner is None:
                    first_active_banner = banner
        
        return user_banner_urls, first_active_banner
        
    except Exception as e:
        return [], None


def get_active_user_banners():
    """활성화된 사용자 배너들을 가져오기 (기존 함수 - 하위 호환성 유지)"""
    user_banner_urls, _ = get_active_user_banners_with_info()
    return user_banner_urls