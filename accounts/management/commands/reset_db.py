# 실행 방법: makemigrations -> migrate -> python manage.py reset_db

# accounts/management/commands/reset_db.py
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.contrib.auth.hashers import make_password
from django.utils import timezone
import os
import shutil
from accounts.models import User
# from ddokfarm.models import Category  # 카테고리만 유지
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment
from django.core.files.images import ImageFile
import random
from datetime import timedelta, date

class Command(BaseCommand):
    help = '데이터베이스를 초기화하고 기본 데이터를 자동으로 로드합니다'

    def add_arguments(self, parser):
        parser.add_argument(
            '--backup',
            action='store_true',
            help='현재 미디어 파일을 백업합니다',
        )
        parser.add_argument(
            '--restore',
            action='store_true',
            help='백업된 미디어 파일을 복원합니다',
        )

    def handle(self, *args, **options):
        # 미디어 폴더 내 이미지 경로 설정
        self.default_image_path = "accounts/management/commands/pic/mandoo.jpg"
        
        # 미디어 백업 처리
        if options['backup']:
            self.backup_media_files()
            self.stdout.write(self.style.SUCCESS('미디어 파일 백업이 완료되었습니다.'))
            return

        # 미디어 복원 처리
        if options['restore']:
            self.restore_media_files()
            self.stdout.write(self.style.SUCCESS('미디어 파일 복원이 완료되었습니다.'))
            return

        # 데이터베이스 초기화
        self.stdout.write(self.style.WARNING('데이터베이스 초기화 중...'))
        call_command('flush', '--no-input')
        
        # 마이그레이션 적용!
        self.stdout.write(self.style.WARNING('마이그레이션 파일 생성 중...'))
        call_command('makemigrations')
        
        self.stdout.write(self.style.WARNING('마이그레이션 적용 중...'))
        call_command('migrate')
        
        # 미디어 디렉토리 생성
        self.create_media_directories()
        
        # 기본 이미지 복사
        self.copy_default_image()
        
        # 기본 데이터 생성
        self.create_default_data()
        
        self.stdout.write(self.style.SUCCESS('데이터베이스 초기화 및 기본 데이터 생성이 완료되었습니다!'))
        
        # 접속 정보 안내
        self.stdout.write("\n--- 로그인 정보 ---")
        self.stdout.write(f"관리자: admin / admin1234")
        self.stdout.write(f"일반 사용자: testuser / test1234")
        self.stdout.write(f"아이돌 팬: btsfan / test1234")
        self.stdout.write(f"판매자: seller / test1234")
    
    def copy_default_image(self):
        """기본 이미지를 필요한 디렉토리로 복사"""
        if not os.path.exists(self.default_image_path):
            self.stdout.write(self.style.WARNING(f'{self.default_image_path} 이미지를 찾을 수 없습니다.'))
            return False
            
        try:
            # 프로필 이미지로 복사
            profile_dest = os.path.join('media', 'profile', 'sample_profile.jpg')
            shutil.copy(self.default_image_path, profile_dest)
            
            # 상품 이미지로 복사 (ddokfarm용)
            item_dest = os.path.join('media', 'ddokfarm', 'image', 'sample_item.jpg')
            os.makedirs(os.path.join('media', 'ddokfarm', 'image'), exist_ok=True)
            shutil.copy(self.default_image_path, item_dest)
            
            # 덕담 이미지로 복사
            post_dest = os.path.join('media', 'ddokdam', 'image', 'sample_post.jpg')
            os.makedirs(os.path.join('media', 'ddokdam', 'image'), exist_ok=True)
            shutil.copy(self.default_image_path, post_dest)
            
            self.stdout.write(self.style.SUCCESS(f'기본 이미지가 성공적으로 복사되었습니다.'))
            return True
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'이미지 복사 중 오류 발생: {e}'))
            return False
    
    def create_default_data(self):
        self.stdout.write('기본 데이터 생성 중...')
        
        # 관리자 계정 생성
        self.create_default_users()
        
        # 카테고리 생성 (ddokfarm용 - 나중에 사용할 수 있음)
        # self.create_default_categories()
        
        # 샘플 덕담 게시글 생성
        self.create_sample_ddokdam_posts()
        
        # 샘플 덕팜 게시글 생성
        self.create_sample_ddokfarm_posts()
        
        # 샘플 댓글 생성
        self.create_sample_comments()
    
    def create_default_users(self):
        # 프로필 이미지 경로 설정
        profile_image_path = 'profile/sample_profile.jpg' if os.path.exists('media/profile/sample_profile.jpg') else ''
        
        # 관리자 계정
        admin_user = User.objects.create(
            username='admin',
            email='admin@example.com',
            password=make_password('admin1234'),
            is_superuser=True,
            is_staff=True,
            date_joined=timezone.now()
        )
        
        # 일반 사용자 계정
        test_user = User.objects.create(
            username='testuser',
            email='test@example.com',
            password=make_password('test1234'),
            date_joined=timezone.now()
        )
        
        # 아이돌 팬 계정
        fan_user = User.objects.create(
            username='btsfan',
            email='btsfan@example.com',
            password=make_password('test1234'),
            date_joined=timezone.now()
        )
        
        # 판매자 계정
        seller_user = User.objects.create(
            username='seller',
            email='seller@example.com',
            password=make_password('test1234'),
            date_joined=timezone.now()
        )
        
        # 프로필 이미지 설정
        if profile_image_path:
            try:
                with open(f'media/{profile_image_path}', 'rb') as img_file:
                    admin_user.profile_image.save('admin_profile.jpg', ImageFile(img_file), save=True)
                    test_user.profile_image.save('test_profile.jpg', ImageFile(img_file), save=True)
                    fan_user.profile_image.save('fan_profile.jpg', ImageFile(img_file), save=True)
                    seller_user.profile_image.save('seller_profile.jpg', ImageFile(img_file), save=True)
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'프로필 이미지 설정 중 오류: {e}'))
        
        self.stdout.write(self.style.SUCCESS('기본 사용자 계정이 생성되었습니다.'))
    
    # def create_default_categories(self):
    #     # 덕팜 카테고리 (나중에 사용할 수 있도록 유지)
    #     categories = [
    #         {'name': '중고거래', 'slug': 'junggogeorae'},
    #         {'name': '응원봉 대여', 'slug': 'eungwonbongdaeyeo'},
    #         {'name': '분철팟', 'slug': 'split'}
    #     ]
        
    #     for cat_data in categories:
    #         Category.objects.create(**cat_data)
        
    #     self.stdout.write(self.style.SUCCESS('기본 카테고리가 생성되었습니다.'))
    
    def create_sample_ddokdam_posts(self):
        # 유저 가져오기
        admin_user = User.objects.get(username='admin')
        test_user = User.objects.get(username='testuser')
        fan_user = User.objects.get(username='btsfan')
        seller_user = User.objects.get(username='seller')
        
        # 이미지 경로 설정
        image_path = 'ddokdam/image/sample_post.jpg' if os.path.exists('media/ddokdam/image/sample_post.jpg') else ''
        
        # 커뮤니티 게시글
        community_posts = [
            {
                'title': "오늘 팬미팅 다녀왔어요!",
                'content': "오늘 팬미팅 다녀왔는데 정말 행복했습니다! 여러분도 다녀오셨나요?\n멤버들이 너무 친절하고 좋았어요. 다음 팬미팅도 꼭 가고 싶어요.",
                'user': fan_user,
            },
            {
                'title': "뉴진스 새 앨범 언제 나올까요?",
                'content': "뉴진스 새 앨범이 기다려지네요. 혹시 정보 있으신 분 계신가요?\n티저나 소식이 있으면 알려주세요!",
                'user': test_user,
            },
            {
                'title': "AESPA 콘서트 후기",
                'content': "AESPA 콘서트 다녀왔습니다! 정말 최고였어요. 특히 윈터 포커싱 직캠 찍었는데 너무 예뻐요.\n다음 콘서트는 언제일까요?",
                'user': admin_user,
            }
        ]
        
        # 예절샷 게시글
        manner_posts = [
            {
                'title': "홍대 카페 디저트 맛집",
                'content': "홍대에 있는 이 카페 정말 좋았어요! 인형과 함께 예절샷 찍었습니다.\n인스타 감성 가득한 인테리어에 디저트도 정말 맛있어요.",
                'user': test_user,
                'location': "서울 마포구 홍대 어쩌구 카페",
                'item': "BTS 인형"
            },
            {
                'title': "강남역 아이돌 카페",
                'content': "강남역 근처에 있는 아이돌 카페입니다. BTS 테마로 꾸며져 있어요.\n음료도 맛있고 인형과 함께 사진 찍기 좋은 곳입니다!",
                'user': fan_user,
                'location': "서울 강남구 강남대로 102",
                'item': "BTS 인형"
            }
        ]
        
        # 생일카페 게시글
        bdaycafe_posts = [
            {
                'title': "정국 생일카페 정보 공유",
                'content': "정국 생일 기념 카페가 오픈했습니다! 9월 1일부터 9월 10일까지 운영해요.\n굿즈도 다양하고 포토존도 잘 꾸며져 있어요.",
                'user': fan_user,
                'cafe_name': "정국이의 꿀잼 카페",
                # 'cafe_location': "서울 강남구 테헤란로 123",
                # 'start_date': timezone.now().date(),
                # 'end_date': (timezone.now() + timedelta(days=10)).date()
            },
            {
                'title': "윈터 생일 팝업 스토어",
                'content': "윈터 생일 기념 팝업 스토어입니다. 1월 1일부터 1월 15일까지 운영합니다.\n특별 포토카드 증정 이벤트도 있어요!",
                'user': admin_user,
                'cafe_name': "윈터 원더랜드",
                # 'cafe_location': "서울 마포구 와우산로 111",
                # 'start_date': timezone.now().date(),
                # 'end_date': (timezone.now() + timedelta(days=15)).date()
            }
        ]
        
        # 커뮤니티 게시글 생성
        for i, post_data in enumerate(community_posts):
            post = DamCommunityPost.objects.create(**post_data)
            
            # 이미지 설정
            if image_path:
                try:
                    with open(f'media/{image_path}', 'rb') as img_file:
                        post.image.save(f'community_post_{i+1}.jpg', ImageFile(img_file), save=True)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'이미지 설정 중 오류: {e}'))
        
        # 예절샷 게시글 생성
        for i, post_data in enumerate(manner_posts):
            post = DamMannerPost.objects.create(**post_data)
            
            # 이미지 설정
            if image_path:
                try:
                    with open(f'media/{image_path}', 'rb') as img_file:
                        post.image.save(f'manner_post_{i+1}.jpg', ImageFile(img_file), save=True)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'이미지 설정 중 오류: {e}'))
        
        # 생일카페 게시글 생성
        for i, post_data in enumerate(bdaycafe_posts):
            post = DamBdaycafePost.objects.create(**post_data)
            
            # 이미지 설정
            if image_path:
                try:
                    with open(f'media/{image_path}', 'rb') as img_file:
                        post.image.save(f'bdaycafe_post_{i+1}.jpg', ImageFile(img_file), save=True)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'이미지 설정 중 오류: {e}'))
        
        total_posts = len(community_posts) + len(manner_posts) + len(bdaycafe_posts)
        self.stdout.write(self.style.SUCCESS(f'덕담 샘플 게시글 {total_posts}개 생성이 완료되었습니다.'))

    def create_sample_ddokfarm_posts(self):
        """덕팜 샘플 게시글 생성"""
        # 유저 가져오기
        admin_user = User.objects.get(username='admin')
        test_user = User.objects.get(username='testuser')
        fan_user = User.objects.get(username='btsfan')
        seller_user = User.objects.get(username='seller')
        
        # 이미지 경로 설정
        image_path = 'ddokfarm/image/sample_item.jpg' if os.path.exists('media/ddokfarm/image/sample_item.jpg') else ''
        
        # 판매 게시글
        sell_posts = [
            {
                'title': "BTS 지민 포토카드 판매합니다",
                'content': "페이스 더 선 앨범 포토카드입니다. 상태 좋고 보관 잘 했어요.\n직거래 가능하시면 더 저렴하게 드릴게요!",
                'user': seller_user,
                'price': 15000,
                'condition': 'almost_new',
                'shipping': 'both',
                'location': '강남역',
                'want_to': 'sell',
                'is_sold': False,
            },
            {
                'title': "뉴진스 응원봉 급처합니다",
                'content': "뉴진스 공식 응원봉 판매해요. 한 번만 사용했습니다.\n박스, 설명서 모두 있어요.",
                'user': test_user,
                'price': 35000,
                'condition': 'almost_new',
                'shipping': 'delivery',
                'want_to': 'sell',
                'is_sold': False,
            },
            {
                'title': "에스파 윈터 포카 구합니다",
                'content': "마이월드 앨범 윈터 포토카드 찾고 있어요.\n상태 좋은 것으로 부탁드립니다!",
                'user': fan_user,
                'price': 20000,
                'condition': 'new',
                'shipping': 'both',
                'location': '홍대입구',
                'want_to': 'buy',
                'is_sold': False,
            }
        ]
        
        # 대여 게시글
        rental_posts = [
            {
                'title': "세븐틴 응원봉 대여해드려요",
                'content': "세븐틴 콘서트 응원봉 대여 가능합니다.\n콘서트 당일 대여해드려요. 깨끗하게 관리하고 있어요!",
                'user': seller_user,
                'price': 5000,
                'condition': 'used',
                'shipping': 'direct',
                'location': '잠실 종합운동장',
                'want_to': 'sell',
                'start_date': date.today(),
                'end_date': date.today() + timedelta(days=3),
                'is_sold': False,
            },
            {
                'title': "스트레이키즈 콘서트 응원봉 빌려주세요",
                'content': "스트레이키즈 콘서트 가는데 응원봉이 필요해요.\n당일 대여 가능하신 분 연락 주세요!",
                'user': fan_user,
                'price': 3000,
                'condition': 'new',
                'shipping': 'direct',
                'location': 'KSPO돔',
                'want_to': 'buy',
                'start_date': date.today() + timedelta(days=7),
                'end_date': date.today() + timedelta(days=8),
                'is_sold': False,
            }
        ]
        
        # 분철 게시글
        split_posts = [
            {
                'title': "투모로우바이투게더 신앨범 분철팟",
                'content': "투바투 새 앨범 분철팟 모집합니다!\n각 버전별 포토카드 나눠서 가져가요. 총 5명 모집해요.",
                'user': admin_user,
                'album': 'include',
                'opened': 'unopened',
                'shipping_fee': 3000,
                'where': '강남역 스타벅스',
                'when': date.today(),
                'failure': 'split',
            },
            {
                'title': "아이브 I AM 앨범 분철팟 (마감임박)",
                'content': "아이브 아이엠 앨범 분철팟입니다. 1자리 남았어요!\n안유진 위주로 모으시는 분 우선이에요.",
                'user': test_user,
                'album': 'not_include',
                'opened': 'opende',
                'shipping_fee': 2500,
                'where': '홍대 CGV 앞',
                'when': date.today(),
                'failure': 'not_failure',
            }
        ]
        
        # 판매 게시글 생성
        for i, post_data in enumerate(sell_posts):
            post = FarmSellPost.objects.create(**post_data)
            
            # 이미지 설정
            if image_path:
                try:
                    with open(f'media/{image_path}', 'rb') as img_file:
                        post.image.save(f'sell_post_{i+1}.jpg', ImageFile(img_file), save=True)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'이미지 설정 중 오류: {e}'))
        
        # 대여 게시글 생성
        for i, post_data in enumerate(rental_posts):
            post = FarmRentalPost.objects.create(**post_data)
            
            # 이미지 설정
            if image_path:
                try:
                    with open(f'media/{image_path}', 'rb') as img_file:
                        post.image.save(f'rental_post_{i+1}.jpg', ImageFile(img_file), save=True)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'이미지 설정 중 오류: {e}'))
        
        # 분철 게시글 생성
        for i, post_data in enumerate(split_posts):
            post = FarmSplitPost.objects.create(**post_data)
            
            # 이미지 설정
            if image_path:
                try:
                    with open(f'media/{image_path}', 'rb') as img_file:
                        post.image.save(f'split_post_{i+1}.jpg', ImageFile(img_file), save=True)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'이미지 설정 중 오류: {e}'))
        
        total_posts = len(sell_posts) + len(rental_posts) + len(split_posts)
        self.stdout.write(self.style.SUCCESS(f'덕팜 샘플 게시글 {total_posts}개 생성이 완료되었습니다.'))
    
    def create_sample_comments(self):
        # 유저 가져오기
        admin_user = User.objects.get(username='admin')
        test_user = User.objects.get(username='testuser')
        fan_user = User.objects.get(username='btsfan')
        seller_user = User.objects.get(username='seller')
        
        # 덕담 댓글 내용
        ddokdam_comments = [
            "저도 다녀왔어요! 정말 좋았죠?",
            "정보 감사합니다!",
            "위치가 어디인가요?",
            "사진 너무 예쁘네요!",
            "저도 가보고 싶어요~",
            "가격은 어느 정도인가요?",
            "예절샷 너무 귀여워요!",
            "인형 어디서 사셨나요?",
            "생일카페 꼭 가볼게요!",
            "운영 시간이 어떻게 되나요?"
        ]
        
        # 덕팜 댓글 내용
        ddokfarm_comments = [
            "네고 가능한가요?",
            "상태 더 자세히 알 수 있을까요?",
            "직거래 가능한 시간이 언제인가요?",
            "아직 판매 중이신가요?",
            "분철팟 참여하고 싶어요!",
            "택배비는 얼마인가요?",
            "사진 더 보여주실 수 있나요?",
            "언제까지 모집하시나요?",
            "구매 의사 있습니다!",
            "대여 날짜 조정 가능한가요?"
        ]
        
        # 각 카테고리별 게시글에 댓글 추가
        all_users = [admin_user, test_user, fan_user, seller_user]
        
        # 덕담 댓글 생성
        # 커뮤니티 게시글에 댓글
        for post in DamCommunityPost.objects.all():
            num_comments = random.randint(1, 3)
            for _ in range(num_comments):
                user = random.choice(all_users)
                content = random.choice(ddokdam_comments)
                
                DamComment.objects.create(
                    community_post=post,
                    user=user,
                    content=content
                )
        
        # 예절샷 게시글에 댓글
        for post in DamMannerPost.objects.all():
            num_comments = random.randint(1, 3)
            for _ in range(num_comments):
                user = random.choice(all_users)
                content = random.choice(ddokdam_comments)
                
                DamComment.objects.create(
                    manner_post=post,
                    user=user,
                    content=content
                )
        
        # 생일카페 게시글에 댓글
        for post in DamBdaycafePost.objects.all():
            num_comments = random.randint(1, 3)
            for _ in range(num_comments):
                user = random.choice(all_users)
                content = random.choice(ddokdam_comments)
                
                DamComment.objects.create(
                    bdaycafe_post=post,
                    user=user,
                    content=content
                )
        
        # 덕팜 댓글 생성
        # 판매 게시글에 댓글
        for post in FarmSellPost.objects.all():
            num_comments = random.randint(1, 4)
            for _ in range(num_comments):
                user = random.choice(all_users)
                content = random.choice(ddokfarm_comments)
                
                FarmComment.objects.create(
                    sell_post=post,
                    user=user,
                    content=content
                )
        
        # 대여 게시글에 댓글
        for post in FarmRentalPost.objects.all():
            num_comments = random.randint(1, 4)
            for _ in range(num_comments):
                user = random.choice(all_users)
                content = random.choice(ddokfarm_comments)
                
                FarmComment.objects.create(
                    rental_post=post,
                    user=user,
                    content=content
                )
        
        # 분철 게시글에 댓글
        for post in FarmSplitPost.objects.all():
            num_comments = random.randint(1, 4)
            for _ in range(num_comments):
                user = random.choice(all_users)
                content = random.choice(ddokfarm_comments)
                
                FarmComment.objects.create(
                    split_post=post,
                    user=user,
                    content=content
                )
        
        # 대댓글 추가 (덕담)
        for comment in DamComment.objects.all():
            # 20% 확률로 대댓글 추가
            if random.random() < 0.2:
                user = random.choice(all_users)
                if user != comment.user:  # 원 댓글 작성자가 아닌 경우만
                    replies = [
                        f"네, 가능합니다!",
                        f"안녕하세요 {user.username}님, 답변 드립니다.",
                        f"감사합니다 :)",
                        f"추가 정보 올려드렸어요!"
                    ]
                    
                    # 원 게시글 작성자가 답변
                    if comment.community_post:
                        original_author = comment.community_post.user
                        DamComment.objects.create(
                            community_post=comment.community_post,
                            user=original_author,
                            content=random.choice(replies),
                            parent=comment
                        )
                    elif comment.manner_post:
                        original_author = comment.manner_post.user
                        DamComment.objects.create(
                            manner_post=comment.manner_post,
                            user=original_author,
                            content=random.choice(replies),
                            parent=comment
                        )
                    elif comment.bdaycafe_post:
                        original_author = comment.bdaycafe_post.user
                        DamComment.objects.create(
                            bdaycafe_post=comment.bdaycafe_post,
                            user=original_author,
                            content=random.choice(replies),
                            parent=comment
                        )
        
        # 대댓글 추가 (덕팜)
        for comment in FarmComment.objects.all():
            # 20% 확률로 대댓글 추가
            if random.random() < 0.2:
                user = random.choice(all_users)
                if user != comment.user:  # 원 댓글 작성자가 아닌 경우만
                    farm_replies = [
                        "네, 연락 주세요!",
                        "DM으로 연락 드릴게요.",
                        "감사합니다!",
                        "자세한 사항은 개인 메시지로요~"
                    ]
                    
                    # 원 게시글 작성자가 답변
                    if comment.sell_post:
                        original_author = comment.sell_post.user
                        FarmComment.objects.create(
                            sell_post=comment.sell_post,
                            user=original_author,
                            content=random.choice(farm_replies),
                            parent=comment
                        )
                    elif comment.rental_post:
                        original_author = comment.rental_post.user
                        FarmComment.objects.create(
                            rental_post=comment.rental_post,
                            user=original_author,
                            content=random.choice(farm_replies),
                            parent=comment
                        )
                    elif comment.split_post:
                        original_author = comment.split_post.user
                        FarmComment.objects.create(
                            split_post=comment.split_post,
                            user=original_author,
                            content=random.choice(farm_replies),
                            parent=comment
                        )
        
        self.stdout.write(self.style.SUCCESS('샘플 댓글 생성이 완료되었습니다.'))
    
    def create_media_directories(self):
        # 필요한 미디어 디렉토리 생성
        media_dirs = [
            'media/profile',
            'media/ddokdam/image',
            'media/ddokfarm/image'  # ddokfarm용 디렉토리 추가
        ]
        
        for d in media_dirs:
            os.makedirs(d, exist_ok=True)
        
        self.stdout.write(self.style.SUCCESS('미디어 디렉토리가 생성되었습니다.'))
    
    def backup_media_files(self):
        if os.path.exists('media'):
            self.stdout.write('미디어 파일 백업 중...')
            # media_backup 폴더가 없으면 생성
            os.makedirs('media_backup', exist_ok=True)
            # media 폴더를 media_backup으로 복사
            shutil.copytree('media', 'media_backup', dirs_exist_ok=True)
            self.stdout.write(self.style.SUCCESS('미디어 파일이 media_backup에 백업되었습니다.'))
        else:
            self.stdout.write(self.style.WARNING('미디어 폴더가 존재하지 않습니다.'))

    def restore_media_files(self):
        if os.path.exists('media_backup'):
            self.stdout.write('미디어 파일 복원 중...')
            # media 폴더 삭제 후 복원
            if os.path.exists('media'):
                shutil.rmtree('media')
            shutil.copytree('media_backup', 'media')
            self.stdout.write(self.style.SUCCESS('미디어 파일이 복원되었습니다.'))
        else:
            self.stdout.write(self.style.ERROR('백업된 미디어 파일이 존재하지 않습니다.'))