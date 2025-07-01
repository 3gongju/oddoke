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
        community_posts = list(DamCommunityPost.objects.select_related('user').prefetch_related('images').order_by('-created_at')[:4])
        for post in community_posts:
            post.category = 'community'
            # 필요한 속성 추가
            if not hasattr(post, 'like_count'):
                post.like_count = 0
            if not hasattr(post, 'view_count'):
                post.view_count = 0
            if not hasattr(post, 'comment_count'):
                post.comment_count = 0
            latest_ddokdam_posts.append(post)

        # 예절샷, 생일카페 포스트도 추가
        manner_posts = list(DamMannerPost.objects.select_related('user').prefetch_related('images').order_by('-created_at')[:2])
        for post in manner_posts:
            post.category = 'manner'
            if not hasattr(post, 'like_count'):
                post.like_count = 0
            if not hasattr(post, 'view_count'):
                post.view_count = 0
            if not hasattr(post, 'comment_count'):
                post.comment_count = 0
            latest_ddokdam_posts.append(post)

        # 전체 4개로 제한
        latest_ddokdam_posts = latest_ddokdam_posts[:4]
            
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
            'subtitle': '어디서든, 어떻게든 덕질해!',
            'description': '덕질 올인원 종합 플랫폼',
            'type': 'welcome',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '덕팜, 굿즈 거래의 새로운 방식',
            'subtitle': '제각각이던 게시글 형식을 통일해, 기존 트위터 거래의 문제점을 개선했어요!',
            'type': 'ddokfarm',
            'image': DEFAULT_SLIDE_IMAGE,
            'real_data': latest_ddokfarm_posts
        },
        {
            'title': '덕담, 팬들만의 소통 공간',
            'subtitle': '나만의 덕질 기록, 다른 유저들과 자유롭게 소통해요!',
            'type': 'ddokdam',
            'image': DEFAULT_SLIDE_IMAGE,
            'real_data': latest_ddokdam_posts[:4]
        },
        {
            'title': '덕생, 카카오 지도기반 생카 아카이브',
            'subtitle': '내 위치 주변 생카를 확인해보세요!',
            'type': 'ddoksang',
            'image': DEFAULT_SLIDE_IMAGE,
            'real_data': birthday_artists,
            'stats_data': birthday_stats
        },
        {
            'title': '덕챗, 안전한 1:1 실시간 채팅',
            'subtitle': '편리한 계좌 및 주소 정보 공유, 사기 조회까지 지원해요!',
            # 'description': '굿즈 거래를 안전하게, 실시간 채팅으로',
            'type': 'ddokchat',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '아이돌 굿즈 거래의 신뢰성 강화',
            'subtitle': '체계적인 신뢰 시스템으로 믿을 수 있는 거래 환경을 제공해요!',
            # 'description': '공식 팬덤 인증, 사기 신고 제도, 매너 리뷰 시스템',
            'type': 'safety',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '찜한 아티스트만 골라보는 나만의 피드',
            'subtitle': '덕팜 & 덕담에서 찜한 아티스트 게시글만 필터링해 볼 수 있어요!',
            # 'description': '찜한 아티스트들의 최신 소식을 놓치지 마세요',
            'type': 'favorite_artists',
            'image': DEFAULT_SLIDE_IMAGE,
            'real_data': raw_favs
        },
        {
            'title': '내 최애 생일시 맞추고 덕 쌓기',
            'subtitle': '게임에서 1000덕을 모으면 마이페이지에서 배너 광고를 신청할 수 있어요!',
            'type': 'ddokgame',
            'image': DEFAULT_SLIDE_IMAGE
        },
        {
            'title': '자세한 사항은 웹 하단 서비스 안내 및 FAQ를 확인하세요!',
            'type': 'faq',
            'image': DEFAULT_SLIDE_IMAGE
        },
        # {
        #     'title': '커뮤니티 기능',
        #     'subtitle': '팬들과 함께 만드는 문화',
        #     'description': '후기, 리뷰, 정보 공유로 더 풍부한 덕질',
        #     'type': 'community',
        #     'image': DEFAULT_SLIDE_IMAGE
        # },
        # {
        #     'title': '이벤트 & 혜택',
        #     'subtitle': '특별한 혜택과 이벤트',
        #     'description': '정기적인 이벤트와 어덕해 주민들 전용 혜택 IS COMING SOON',
        #     'type': 'events',
        #     'image': DEFAULT_SLIDE_IMAGE
        # },
        # {
        #     'title': '24/7 고객 지원',
        #     'subtitle': '언제든 도움을 받으세요',
        #     'description': '빠른 문의 응답과 친절한 고객 서비스',
        #     'type': 'support',
        #     'image': DEFAULT_SLIDE_IMAGE
        # },
        # {
        #     'title': '개인정보 보호',
        #     'subtitle': '안전한 개인정보 관리',
        #     'description': '철저한 보안으로 개인정보를 보호합니다',
        #     'type': 'privacy',
        #     'image': DEFAULT_SLIDE_IMAGE
        # },
        # {
        #     'title': '글로벌 서비스',
        #     'subtitle': '전 세계 팬들과 연결',
        #     'description': '(ENGLISH VERSION IS 커밍쑨)',
        #     'type': 'global',
        #     'image': DEFAULT_SLIDE_IMAGE
        # },
        # {
        #     'title': '실시간 알림',
        #     'subtitle': '중요한 소식을 놓치지 마세요',
        #     'description': '관심 아티스트의 새로운 소식을 실시간으로',
        #     'type': 'notifications',
        #     'image': DEFAULT_SLIDE_IMAGE
        # },
        # {
        #     'title': '팬클럽 연동',
        #     'subtitle': '공식 팬클럽과의 연계',
        #     'description': '공식 정보와 이벤트를 한 번에',
        #     'type': 'fanclub',
        #     'image': DEFAULT_SLIDE_IMAGE
        # },
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
        'today': timezone.now().date(),
    }
    return render(request, 'main/intro.html', context)

def get_active_user_banners_with_info():
    """각 배너별 신청자 정보를 함께 반환"""
    try:
        from django.utils import timezone
        from accounts.models import get_banner_display_days  # import 추가
        
        today = timezone.now().date()
        now = timezone.now()
        display_days = get_banner_display_days()  # 설정값 사용
        
        active_banners = BannerRequest.objects.filter(
            status='approved',
            approved_at__isnull=False,
            is_active=True
        ).select_related('user').order_by('-approved_at')
        
        date_filtered_banners = []
        for banner in active_banners:
            if banner.start_date and banner.end_date:
                if banner.start_date <= today <= banner.end_date:
                    date_filtered_banners.append(banner)
            else:
                # 설정값 사용한 날짜 계산
                if banner.approved_at:
                    approved_date = banner.approved_at.date()
                    end_date = approved_date + timezone.timedelta(days=display_days)
                    if approved_date <= today <= end_date:
                        date_filtered_banners.append(banner)
        
        final_banners = []
        for banner in date_filtered_banners:
            if banner.expires_at:
                if banner.expires_at > now:
                    final_banners.append(banner)
            else:
                final_banners.append(banner)
        
        banner_data = []
        for banner in final_banners:
            if banner.banner_image:
                banner_info = {
                    'url': banner.banner_image.url,
                    'banner_info': banner,
                    'user': banner.user,
                    'artist_name': banner.artist_name
                }
                banner_data.append(banner_info)
        
        return banner_data
        
    except Exception as e:
        return []

def main(request):
    # 1) 찜한 아티스트 원본 목록
    raw_favs = list(Artist.objects.filter(followers=request.user)) if request.user.is_authenticated else []

    # 2) 그룹별 페이징 캐러셀을 위한 5개씩 묶기
    grouped_artists = group_artists(raw_favs) if raw_favs else []

    # 3) 🔥 수정된 배너 관련 로직 - 각 배너별 정보 포함
    user_banner_data = get_active_user_banners_with_info()
    
    # 기본 배너 이미지들 (신청자 정보 없음)
    default_banner_data = [
        {'url': 'image/banner/banner1.jpg', 'banner_info': None, 'user': None, 'artist_name': None},
        {'url': 'image/banner/banner2.jpg', 'banner_info': None, 'user': None, 'artist_name': None},
        {'url': 'image/banner/banner3.jpg', 'banner_info': None, 'user': None, 'artist_name': None},
        {'url': 'image/banner/banner4.jpg', 'banner_info': None, 'user': None, 'artist_name': None},
    ]
    
    # 사용자 배너와 기본 배너를 함께 표시
    all_banner_data = user_banner_data + default_banner_data
    
    # 템플릿에서 사용할 배너 이미지 URL 리스트 (기존 호환성)
    banner_images = [banner['url'] for banner in all_banner_data]
    
    # 첫 번째 사용자 배너가 있으면 그것을 active_banner로 설정
    active_banner = user_banner_data[0]['banner_info'] if user_banner_data else None

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
        'banner_images': banner_images,  # 기존 호환성용 URL 리스트
        'all_banner_data': all_banner_data,  # 🔥 새로 추가: 각 배너별 상세 정보
        'active_banner': active_banner,  # 첫 번째 사용자 배너 정보

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
    """활성화된 사용자 배너들을 가져오기 (기존 함수 - 하위 호환성 유지)"""
    banner_data = get_active_user_banners_with_info()
    return [banner['url'] for banner in banner_data]