#실행 방법: makemigrations -> migrate -> python manage.py reset_db

# accounts/management/commands/reset_db.py
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.contrib.auth.hashers import make_password
from django.utils import timezone
import os
import shutil
from accounts.models import User
from ddokfarm.models import Category, DdokfarmPost, DdokfarmComment
from ddokdam.models import DdokdamPost, DdokdamComment
from django.core.files.images import ImageFile
import random
from datetime import timedelta

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
        
        # 마이그레이션 적용
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
            
            # 상품 이미지로 복사
            item_dest = os.path.join('media', 'image', 'sample_item.jpg')
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
        
        # 카테고리 생성
        self.create_default_categories()
        
        # 샘플 덕팜 게시글 생성
        self.create_sample_ddokfarm_posts()
        
        # 샘플 덕담 게시글 생성
        self.create_sample_ddokdam_posts()
        
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
            with open(f'media/{profile_image_path}', 'rb') as img_file:
                admin_user.profile_image.save('admin_profile.jpg', ImageFile(img_file), save=True)
                test_user.profile_image.save('test_profile.jpg', ImageFile(img_file), save=True)
                fan_user.profile_image.save('fan_profile.jpg', ImageFile(img_file), save=True)
                seller_user.profile_image.save('seller_profile.jpg', ImageFile(img_file), save=True)
        
        self.stdout.write(self.style.SUCCESS('기본 사용자 계정이 생성되었습니다.'))
    
    def create_default_categories(self):
        # 덕팜 카테고리
        categories = [
            {'name': '중고거래', 'slug': 'junggogeorae'},
            {'name': '응원봉 대여', 'slug': 'eungwonbongdaeyeo'},
            {'name': '분철팟', 'slug': 'split'}
        ]
        
        for cat_data in categories:
            Category.objects.create(**cat_data)
        
        self.stdout.write(self.style.SUCCESS('기본 카테고리가 생성되었습니다.'))
    
    def create_sample_ddokfarm_posts(self):
        # 유저 가져오기
        admin_user = User.objects.get(username='admin')
        test_user = User.objects.get(username='testuser')
        fan_user = User.objects.get(username='btsfan')
        seller_user = User.objects.get(username='seller')
        
        # 카테고리 가져오기
        junggogeorae = Category.objects.get(slug='junggogeorae')
        eungwonbongdaeyeo = Category.objects.get(slug='eungwonbongdaeyeo')
        split = Category.objects.get(slug='split')
        
        # 이미지 경로 설정
        image_path = 'image/sample_item.jpg' if os.path.exists('media/image/sample_item.jpg') else ''
        
        # 중고거래 게시글
        posts_data = [
            {
                'title': "BTS 시즌그리팅 2025 미개봉",
                'content': "BTS 시즌그리팅 2025 버전 미개봉 판매합니다. 직거래 가능합니다.\n택배 배송도 가능합니다.",
                'user': seller_user,
                'price': 35000,
                'category': junggogeorae,
                'condition': "new",
                'exchange': "impossible",
                'direct_deal': "possible",
                'preferred_location': "서울특별시 강남구",
                'shipping': "both"
            },
            {
                'title': "NCT 응원봉 새상품",
                'content': "NCT 응원봉 미개봉 새상품입니다. 직거래 우선합니다.\n포장 상태 좋습니다.",
                'user': admin_user,
                'price': 42000,
                'category': junggogeorae,
                'condition': "new",
                'exchange': "impossible",
                'direct_deal': "possible",
                'preferred_location': "서울특별시 마포구",
                'shipping': "both"
            },
            {
                'title': "BLACKPINK 포토카드 세트",
                'content': "BLACKPINK 멤버 전원 포토카드 세트입니다. 보관 상태 좋습니다.\n구매 후 보관만 했습니다.",
                'user': test_user,
                'price': 18000,
                'category': junggogeorae,
                'condition': "almost_new",
                'exchange': "possible",
                'direct_deal': "impossible",
                'shipping': "delivery"
            },
            {
                'title': "TWICE 앨범 Born This Way",
                'content': "TWICE 정규 앨범 판매합니다. 포카 없이 앨범만 판매합니다.\n직거래 원합니다.",
                'user': fan_user,
                'price': 15000,
                'category': junggogeorae,
                'condition': "used",
                'exchange': "impossible",
                'direct_deal': "possible",
                'preferred_location': "서울특별시 홍대입구역",
                'shipping': "direct"
            }
        ]
        
        # 응원봉 대여 게시글
        rental_posts = [
            {
                'title': "BTS 응원봉 1일 대여",
                'content': "BTS 공식 응원봉 1일 대여합니다. 보증금 5만원, 대여료 1만원입니다.\n훼손 시 보증금에서 차감됩니다.",
                'user': fan_user,
                'price': 10000,
                'category': eungwonbongdaeyeo,
                'condition': "used",
                'exchange': "impossible",
                'direct_deal': "possible",
                'preferred_location': "서울특별시 홍대입구역",
                'shipping': "direct"
            },
            {
                'title': "AESPA 응원봉 주말 대여",
                'content': "AESPA 응원봉 주말 대여합니다. 보증금 4만원, 대여료 7천원입니다.\n깨끗하고 작동 상태 좋습니다.",
                'user': seller_user,
                'price': 7000,
                'category': eungwonbongdaeyeo,
                'condition': "almost_new",
                'exchange': "impossible",
                'direct_deal': "possible",
                'preferred_location': "서울특별시 신촌역",
                'shipping': "direct"
            }
        ]
        
        # 분철팟 게시글
        split_posts = [
            {
                'title': "NCT DREAM 화보집 분철팟 모집",
                'content': "NCT DREAM 화보집 분철팟 모집합니다. 총 10명 모집 중이며, 현재 3명 모였습니다.\n비용은 1인당 5천원입니다.",
                'user': admin_user,
                'price': 5000,
                'category': split,
                'condition': "new",
                'exchange': "impossible",
                'direct_deal': "possible",
                'preferred_location': "서울특별시 강남구",
                'shipping': "both"
            },
            {
                'title': "SEVENTEEN 포토북 분철팟 (3/6)",
                'content': "SEVENTEEN 포토북 분철팟 모집합니다. 총 6명 모집 중이며, 현재 3명 모였습니다.\n8월 15일 분철 예정입니다.",
                'user': test_user,
                'price': 8000,
                'category': split,
                'condition': "new",
                'exchange': "impossible",
                'direct_deal': "possible",
                'preferred_location': "서울특별시 신촌역",
                'shipping': "both"
            }
        ]
        
        # 모든 게시글 데이터 합치기
        all_posts = posts_data + rental_posts + split_posts
        
        # 샘플 게시글 생성
        for i, post_data in enumerate(all_posts):
            post = DdokfarmPost.objects.create(**post_data)
            
            # 이미지 설정
            if image_path:
                with open(f'media/{image_path}', 'rb') as img_file:
                    post.image.save(f'sample_item_{i+1}.jpg', ImageFile(img_file), save=True)
            
            # 일부 게시글은 판매완료로 설정
            if i % 4 == 0:
                post.is_sold = True
                post.save()
        
        self.stdout.write(self.style.SUCCESS(f'덕팜 샘플 게시글 {len(all_posts)}개 생성이 완료되었습니다.'))
    
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
                'category': "community",
                'idol': "bts"
            },
            {
                'title': "뉴진스 새 앨범 언제 나올까요?",
                'content': "뉴진스 새 앨범이 기다려지네요. 혹시 정보 있으신 분 계신가요?\n티저나 소식이 있으면 알려주세요!",
                'user': test_user,
                'category': "community",
                'idol': "newjeans"
            },
            {
                'title': "AESPA 콘서트 후기",
                'content': "AESPA 콘서트 다녀왔습니다! 정말 최고였어요. 특히 윈터 포커싱 직캠 찍었는데 너무 예뻐요.\n다음 콘서트는 언제일까요?",
                'user': admin_user,
                'category': "community",
                'idol': "aespa"
            }
        ]
        
        # 예절샷 게시글 - doll 필드 제거하고 idol 필드로 대체
        food_posts = [
            {
                'title': "홍대 카페 디저트 맛집",
                'content': "홍대에 있는 이 카페 정말 좋았어요! 인형과 함께 예절샷 찍었습니다.\n인스타 감성 가득한 인테리어에 디저트도 정말 맛있어요.",
                'user': test_user,
                'category': "food",
                'location': "서울 마포구 홍대 어쩌구 카페",
                'idol': "bts"  # doll 대신 idol 필드 사용
            },
            {
                'title': "강남역 아이돌 카페",
                'content': "강남역 근처에 있는 아이돌 카페입니다. BTS 테마로 꾸며져 있어요.\n음료도 맛있고 인형과 함께 사진 찍기 좋은 곳입니다!",
                'user': fan_user,
                'category': "food",
                'location': "서울 강남구 강남대로 102",
                'idol': "bts"  # doll 대신 idol 필드 사용
            }
        ]
        
        # 생일카페 게시글은 유지
        cafe_posts = [
            {
                'title': "정국 생일카페 정보 공유",
                'content': "정국 생일 기념 카페가 오픈했습니다! 9월 1일부터 9월 10일까지 운영해요.\n굿즈도 다양하고 포토존도 잘 꾸며져 있어요.",
                'user': fan_user,
                'category': "cafe",
                'idol': "bts",
                'cafe_name': "정국이의 꿀잼 카페",
                'cafe_location': "서울 강남구 테헤란로 123",
                'start_date': timezone.now().date(),
                'end_date': (timezone.now() + timedelta(days=10)).date()
            },
            {
                'title': "윈터 생일 팝업 스토어",
                'content': "윈터 생일 기념 팝업 스토어입니다. 1월 1일부터 1월 15일까지 운영합니다.\n특별 포토카드 증정 이벤트도 있어요!",
                'user': admin_user,
                'category': "cafe",
                'idol': "aespa",
                'cafe_name': "윈터 원더랜드",
                'cafe_location': "서울 마포구 와우산로 111",
                'start_date': timezone.now().date(),
                'end_date': (timezone.now() + timedelta(days=15)).date()
            }
        ]
        
        # 모든 게시글 데이터 합치기
        all_posts = community_posts + food_posts + cafe_posts
        
        # 샘플 게시글 생성
        for i, post_data in enumerate(all_posts):
            post = DdokdamPost.objects.create(**post_data)
            
            # 이미지 설정
            if image_path:
                with open(f'media/{image_path}', 'rb') as img_file:
                    post.image.save(f'sample_post_{i+1}.jpg', ImageFile(img_file), save=True)
        
        self.stdout.write(self.style.SUCCESS(f'덕담 샘플 게시글 {len(all_posts)}개 생성이 완료되었습니다.'))
    
    def create_sample_comments(self):
        # 유저 가져오기
        admin_user = User.objects.get(username='admin')
        test_user = User.objects.get(username='testuser')
        fan_user = User.objects.get(username='btsfan')
        seller_user = User.objects.get(username='seller')
        
        # 덕팜 게시글에 댓글 추가
        ddokfarm_posts = DdokfarmPost.objects.all()
        
        ddokfarm_comments = [
            "가격 좀 내려주실 수 있나요?",
            "직거래 가능하신가요?",
            "상태가 어떤가요?",
            "아직 판매 중인가요?",
            "다른 지역에서도 직거래 가능하신가요?",
            "택배비는 별도인가요?",
            "네고 가능할까요?",
            "구매 원해요! 쪽지 드렸습니다.",
            "상태 사진 더 올려주실 수 있나요?",
            "구매했던 시기가 언제인가요?"
        ]
        
        # 덕담 게시글에 댓글 추가
        ddokdam_posts = DdokdamPost.objects.all()
        
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
        
        # 덕팜 댓글 생성
        for post in ddokfarm_posts:
            # 각 게시글마다 1~3개의 댓글 생성
            num_comments = random.randint(1, 3)
            for _ in range(num_comments):
                # 랜덤 사용자, 랜덤 댓글 내용
                user = random.choice([admin_user, test_user, fan_user, seller_user])
                content = random.choice(ddokfarm_comments)
                
                DdokfarmComment.objects.create(
                    post=post,
                    user=user,
                    content=content
                )
        
        # 덕담 댓글 생성
        for post in ddokdam_posts:
            # 각 게시글마다 1~3개의 댓글 생성
            num_comments = random.randint(1, 3)
            for _ in range(num_comments):
                # 랜덤 사용자, 랜덤 댓글 내용
                user = random.choice([admin_user, test_user, fan_user, seller_user])
                content = random.choice(ddokdam_comments)
                
                DdokdamComment.objects.create(
                    post=post,
                    user=user,
                    content=content
                )
        
        # 대댓글 추가 (덕팜)
        for comment in DdokfarmComment.objects.all():
            # 20% 확률로 대댓글 추가
            if random.random() < 0.2:
                user = random.choice([admin_user, test_user, fan_user, seller_user])
                if user != comment.user:  # 원 댓글 작성자가 아닌 경우만
                    replies = [
                        f"네, 가능합니다!",
                        f"안녕하세요 {user.username}님, 답변 드립니다.",
                        f"감사합니다 :)",
                        f"쪽지 확인했습니다!",
                        f"추가 사진 올려드렸어요!"
                    ]
                    
                    DdokfarmComment.objects.create(
                        post=comment.post,
                        user=comment.post.user,  # 게시글 작성자가 답변
                        content=random.choice(replies),
                        parent=comment
                    )
        
        self.stdout.write(self.style.SUCCESS('샘플 댓글 생성이 완료되었습니다.'))
    
    def create_media_directories(self):
        # 필요한 미디어 디렉토리 생성
        media_dirs = [
            'media/profile',
            'media/ddokdam/image',
            'media/image'
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