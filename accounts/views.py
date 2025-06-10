from django.shortcuts import get_object_or_404, render, redirect
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils.timezone import now
from django.http import JsonResponse
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator
from itertools import chain
from PIL import Image, ExifTags
from dotenv import load_dotenv
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment
from ddokchat.models import ChatRoom 
from artist.models import Artist, Member
from .models import User, MannerReview
from .forms import CustomUserCreationForm, EmailAuthenticationForm, MannerReviewForm, ProfileImageForm
from collections import Counter

import uuid
import requests
import json
import os
import time

load_dotenv()


# Create your views here.
def signup(request):
    preview_image_url = None

    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save(commit=False)
            user.is_active = False  # 이메일 인증 전까지 비활성화
            user = form.save()
            
            if user.profile_image:
                preview_image_url = user.profile_image.url

            # ✅ 이메일 인증 토큰 생성
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            activation_link = request.build_absolute_uri(
                f'/accounts/activate/{uid}/{token}/'
            )

            # ✅ HTML 이메일 내용 렌더링
            subject = '어덕해 회원가입 이메일 인증'
            from_email = os.getenv('EMAIL_HOST_USER')
            to = user.email

            # 순수 텍스트 버전 (백업용)
            text_content = f'아래 링크를 클릭해주세요:\n{activation_link}'

            # HTML 형식 버전 (템플릿)
            html_content = render_to_string('emails/activation_email.html', {
                'activation_link': activation_link,
                'user': user
            })

            # 이메일 객체 생성
            msg = EmailMultiAlternatives(subject, text_content, from_email, [to])
            msg.attach_alternative(html_content, "text/html")
            msg.send()

            messages.success(request, '인증 이메일이 전송되었습니다! 이메일을 확인해주세요.')
            return redirect('accounts:login')
    else:
        form = CustomUserCreationForm()
    
    context = {
        'form': form,
        'preview_image_url': preview_image_url,
    }

    return render(request, 'signup.html', context)

def activate(request, uidb64, token):
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user and default_token_generator.check_token(user, token):
        user.is_active = True
        user.save()
        messages.success(request, '🎉 이메일 인증이 완료되었습니다! 이제 로그인할 수 있어요.')
        return redirect('accounts:login')
    else:
        messages.error(request, '⚠️ 인증 링크가 유효하지 않거나 만료되었습니다.')
        return redirect('accounts:login')

def login(request):
    if request.method == 'POST':
        form = EmailAuthenticationForm(request.POST)
        if form.is_valid():
            user = form.get_user()
            auth_login(request, user)

            # next 파라미터 우선 적용
            next_url = request.GET.get('next') or '/'
            return redirect(next_url)
    else:
        form = EmailAuthenticationForm()

    context = {
        'form': form,
    }
    return render(request, 'login.html', context)


@login_required
def logout(request):
    auth_logout(request)
    request.session.flush()
    return redirect('/')

@login_required
def profile(request, username):
    user_profile = User.objects.get(username=username)
    # ✅ 덕담 게시글 모두 가져오기
    community_posts = DamCommunityPost.objects.filter(user=user_profile)
    manner_posts = DamMannerPost.objects.filter(user=user_profile)
    bdaycafe_posts = DamBdaycafePost.objects.filter(user=user_profile)
    ddokdam_posts = sorted(
        chain(community_posts, manner_posts, bdaycafe_posts),
        key=lambda post: post.created_at,
        reverse=True
    )
    # ✅ 덕팜 게시글 모두 가져오기 
    sell_posts = FarmSellPost.objects.filter(user=user_profile)
    rental_posts = FarmRentalPost.objects.filter(user=user_profile)
    split_posts = FarmSplitPost.objects.filter(user=user_profile)
    ddokfarm_posts = sorted(
        chain(sell_posts, rental_posts, split_posts),
        key=lambda post: post.created_at,
        reverse=True
    )
    # ✅ 찜한 아티스트 가져오기
    favorite_artists = Artist.objects.filter(followers=user_profile)

    # ✅ 팔로우 여부 판단
    is_following = False
    if request.user.is_authenticated and request.user != user_profile:
        is_following = user_profile.followers.filter(id=request.user.id).exists()

    return render(request, 'profile.html', {
        'user_profile': user_profile,
        'ddokdam_posts': ddokdam_posts,  # 덕담
        'ddokfarm_posts': ddokfarm_posts,  # 덕팜 
        'favorite_artists': favorite_artists, # 아티스트
        'is_following': is_following, # 팔로잉
    })

@login_required
def follow(request, username):
    me = request.user
    you = User.objects.get(username=username)

    if me==you: # 스스로 팔로우하는 것 방지 (백엔드)
        return redirect('accounts:profile', username)

#   if you in me.followings.all():
    if me in you.followers.all():
        you.followers.remove(me)
        #me.followings.remove(me)
    else:
#        you.followers.add(me)
        me.followings.add(you)
    return redirect('accounts:profile', username)

@login_required
def follow_list(request, username):
    user_profile = get_object_or_404(User, username=username)
    type_ = request.GET.get('type')

    if type_ == 'followers':
        users = user_profile.followers.all()
    elif type_ == 'followings':
        users = user_profile.followings.all()
    else:
        return JsonResponse({'users': []})

    user_data = [{'username': u.username} for u in users]
    return JsonResponse({'users': user_data})

@login_required
def review_home(request, username):
    user_profile = get_object_or_404(User, username=username)

    if request.method == 'POST':
        form = MannerReviewForm(request.POST)
        if form.is_valid():
            review = form.save(commit=False)
            review.user = request.user
            review.target_user = user_profile
            chatroom_id = request.POST.get('chatroom_id')

            if chatroom_id:
                try:
                    chatroom = ChatRoom.objects.get(id=chatroom_id)
                    already_reviewed = MannerReview.objects.filter(
                        user=request.user, target_user=user_profile, chatroom=chatroom
                    ).exists()
                    if already_reviewed:
                        form.add_error(None, "이미 이 채팅방에 대한 리뷰를 작성하셨습니다.")
                    else:
                        review.chatroom = chatroom
                        review.save()
                        return redirect('accounts:review_home', username=username)
                except ChatRoom.DoesNotExist:
                    form.add_error(None, "유효하지 않은 채팅방 정보입니다.")
    else:
        form = MannerReviewForm()

    reviews = MannerReview.objects.filter(target_user=user_profile).order_by('-created_at')

    # ✅ 상세 항목별 카운터 수집
    rating_counter = Counter()
    description_counter = Counter()
    response_counter = Counter()
    politeness_counter = Counter()
    deal_again_counter = Counter()

    for r in reviews:
        rating_counter[f"{r.rating}"] += 1               # 문자열로 변환
        description_counter[r.description_match] += 1   
        response_counter[r.response_speed] += 1          
        politeness_counter[r.politeness] += 1            
        deal_again_counter[r.deal_again] += 1 

    # ✅ 최대값 계산 (막대 너비 비율용)
    max_counts = {
        'rating': max(rating_counter.values(), default=1),
        'description': max(description_counter.values(), default=1),
        'response': max(response_counter.values(), default=1),
        'politeness': max(politeness_counter.values(), default=1),
        'deal_again': max(deal_again_counter.values(), default=1),
    }

    # ✅ JavaScript에서 사용할 수 있도록 JSON 변환
    context = {
        'user_profile': user_profile,
        'form': form,
        'reviews': reviews,
        'rating_counter': json.dumps(dict(rating_counter)),
        'description_counter': json.dumps(dict(description_counter)),
        'response_counter': json.dumps(dict(response_counter)),
        'politeness_counter': json.dumps(dict(politeness_counter)),
        'deal_again_counter': json.dumps(dict(deal_again_counter)),
        'max_counts': max_counts,
    }

    return render(request, 'accounts/review_home.html', context)

@login_required
def mypage(request): 
    user_profile = request.user
    favorite_artists = Artist.objects.filter(followers=user_profile)
    favorite_members = Member.objects.filter(followers=user_profile)
    followed_artist_ids = list(favorite_artists.values_list('id', flat=True))

    # ✅ 내가 쓴 글 (Farm)
    farm_posts = sorted(
        chain(
            FarmSellPost.objects.filter(user=user_profile),
            FarmRentalPost.objects.filter(user=user_profile),
            FarmSplitPost.objects.filter(user=user_profile)
        ),
        key=lambda post: post.created_at,
        reverse=True
    )

    # ✅ 내가 쓴 글 (Dam)
    dam_posts = sorted(
        chain(
            DamCommunityPost.objects.filter(user=user_profile),
            DamMannerPost.objects.filter(user=user_profile),
            DamBdaycafePost.objects.filter(user=user_profile)
        ),
        key=lambda post: post.created_at,
        reverse=True
    )

    # ✅ 내가 찜한 글 (Farm)
    liked_farm_posts = sorted(
        chain(
            FarmSellPost.objects.filter(like=user_profile),
            FarmRentalPost.objects.filter(like=user_profile),
            FarmSplitPost.objects.filter(like=user_profile)
        ),
        key=lambda post: post.created_at,
        reverse=True
    )

    # ✅ 내가 찜한 글 (Dam)
    liked_dam_posts = sorted(
        chain(
            DamCommunityPost.objects.filter(like=user_profile),
            DamMannerPost.objects.filter(like=user_profile),
            DamBdaycafePost.objects.filter(like=user_profile)
        ),
        key=lambda post: post.created_at,
        reverse=True
    )

    # ✅ 내가 쓴 댓글 (Farm, 상위 댓글만)
    farm_comments = FarmComment.objects.filter(user=user_profile, parent__isnull=True)
    dam_comments = DamComment.objects.filter(user=user_profile, parent__isnull=True)

    # 댓글에 연결된 게시글 및 카테고리 추출
    for comment in chain(farm_comments, dam_comments):
        target_model = comment.content_type.model_class()
        target_post = target_model.objects.filter(id=comment.object_id).first()
        comment.target_post = target_post
        comment.category = getattr(target_post, 'category_type', None)

    # ✅ 멤버-아티스트 매핑
    for member in favorite_members:
        matched = next(
            (artist for artist in member.artist_name.all() if artist.id in followed_artist_ids),
            None
        )
        member.matched_artist = matched
        member.filtered_artists = [
            artist for artist in member.artist_name.all() if artist.id in followed_artist_ids
        ]

    my_reviews = MannerReview.objects.filter(user=request.user).order_by('-created_at')
    
    context = {
        'user_profile': user_profile,
        'favorite_artists': favorite_artists,
        'favorite_members': favorite_members,
        'followed_artist_ids': json.dumps(followed_artist_ids),
        'farm_posts': farm_posts,              # 내가 쓴 글
        'liked_farm_posts': liked_farm_posts,            # 내가 찜한 글
        'farm_comments': farm_comments,        # 내가 쓴 댓글
        'dam_posts': dam_posts,              # 내가 쓴 글
        'liked_dam_posts': liked_dam_posts,            # 내가 찜한 글
        'dam_comments': dam_comments,        # 내가 쓴 댓글
        'my_reviews': my_reviews,            # 내가 쓴 리뷰
    }
    return render(request, 'mypage.html', context)
    
@login_required
def edit_profile(request, username):
    user_profile = get_object_or_404(User, username=username)

    if request.method == "POST":
        new_username = request.POST.get("username")
        new_bio = request.POST.get("bio")
        new_first_name = request.POST.get("first_name")  # 닉네임 추가

        # 닉네임 수정
        if new_first_name and new_first_name != request.user.first_name:
            request.user.first_name = new_first_name
            request.user.save()
            messages.success(request, "닉네임이 수정되었습니다.")
            return redirect('accounts:edit_profile', username=request.user.username)

        # 기존 프로필 이름 수정
        if new_username and new_username != request.user.username:
            if User.objects.filter(username=new_username).exists():
                messages.error(request, "이미 존재하는 사용자 이름입니다.")
            else:
                request.user.username = new_username
                request.user.save()
                messages.success(request, "프로필 이름이 수정되었습니다.")
                return redirect('accounts:edit_profile', username=request.user.username)

        # 소개 수정
        if new_bio is not None and new_bio != request.user.bio:
            request.user.bio = new_bio
            request.user.save()
            messages.success(request, "소개가 수정되었습니다.")
            return redirect('accounts:edit_profile', username=request.user.username)

    context = {
        'user_profile': user_profile,
        'artist_list': Artist.objects.all(),  # 🔹 아티스트 목록 전달
    }
    return render(request, 'accounts/edit_profile.html', context)


@login_required
def edit_profile_image(request, username):
    user = get_object_or_404(User, username=username)
    if request.user != user:
        return redirect('accounts:profile', username=username)

    if request.method == 'POST':
        form = ProfileImageForm(request.POST, request.FILES, instance=user)
        if form.is_valid():
            form.save()
            return redirect('accounts:edit_profile', username=username)
    else:
        form = ProfileImageForm(instance=user)

    return render(request, 'accounts/edit_profile_image.html', {
        'form': form,
        'user_profile': user,
    })

@login_required
def upload_fandom_card(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'POST':
        image = request.FILES.get('fandom_card')
        artist_id = request.POST.get('artist_id')

        if not image:
            messages.error(request, '이미지를 업로드해주세요.')
            return redirect('accounts:edit_profile', username=username)

        try:
            img = Image.open(image)

            # ✅ EXIF 자동 회전 제거
            try:
                for orientation in ExifTags.TAGS.keys():
                    if ExifTags.TAGS[orientation] == 'Orientation':
                        break
                exif = img._getexif()
                if exif is not None:
                    orientation_value = exif.get(orientation)
                    if orientation_value == 3:
                        img = img.rotate(180, expand=True)
                    elif orientation_value == 6:
                        img = img.rotate(270, expand=True)
                    elif orientation_value == 8:
                        img = img.rotate(90, expand=True)
            except Exception as e:
                print(f"EXIF 처리 오류: {e}")

            width, height = img.size
            uploaded_ratio = height / width  # 세로형 기준
            print(f"📏 업로드 이미지 실제 크기: {width}x{height}, 비율: {uploaded_ratio:.3f}:1, 포맷: {img.format}")

        except Exception:
            messages.error(request, '이미지를 처리할 수 없습니다.')
            return redirect('accounts:edit_profile', username=username)

        # ✅ 비율 체크 (예시 이미지: 590 x 1278 ≈ 2.165)
        expected_ratio = 1278 / 590
        tolerance = 0.2  # ±20%
        lower_bound = expected_ratio * (1 - tolerance)
        upper_bound = expected_ratio * (1 + tolerance)

        if not (lower_bound <= uploaded_ratio <= upper_bound):
            messages.error(
                request,
                f'⚠️ 이미지 비율이 예시와 다릅니다. 세로 기준 약 2.17:1 (±20%) 이내로 맞춰주세요. '
                f'→ 현재: {uploaded_ratio:.3f}:1'
            )
            return redirect('accounts:edit_profile', username=username)

        # ✅ 저장
        user.fandom_card = image
        user.fandom_artist = get_object_or_404(Artist, id=artist_id)
        user.is_verified_fandom = False
        user.is_pending_verification = True
        user.verification_failed = False
        user.save()

        messages.success(request, '🎫 공식 팬덤 인증 확인 중입니다. (3일 소요)')
        return redirect('accounts:edit_profile', username=username)

# 카카오 로그인 관련 뷰
def kakao_login(request):
    client_id = os.getenv('KAKAO_REST_API_KEY')
    redirect_uri = os.getenv('KAKAO_OAUTH_REDIRECT_URI')
    
    kakao_auth_url = (
        f"https://kauth.kakao.com/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=profile_nickname"
        f"&prompt=login"
    )
    
    return redirect(kakao_auth_url)

def kakao_logout(request):
    """카카오 로그아웃 + 일반 로그아웃"""
    client_id = os.getenv('KAKAO_REST_API_KEY')
    logout_redirect_uri = os.getenv('KAKAO_OAUTH_LOGOUT_REDIRECT_URI')
    
    auth_logout(request)
    
    kakao_logout_url = (
        f"https://kauth.kakao.com/oauth/logout"
        f"?client_id={client_id}"
        f"&logout_redirect_uri={logout_redirect_uri}"
    )
    
    return redirect(kakao_logout_url)

def logout_complete(request):
    return redirect('/')

def kakao_callback(request):
    code = request.GET.get('code')
    
    if not code:
        messages.error(request, '카카오 로그인에 실패했습니다.')
        return redirect('accounts:login')
    
    client_id = os.getenv('KAKAO_REST_API_KEY')
    client_secret = os.getenv('KAKAO_OAUTH_SECRET_ID')
    redirect_uri = os.getenv('KAKAO_OAUTH_REDIRECT_URI')
    
    token_url = 'https://kauth.kakao.com/oauth/token'
    token_data = {
        'grant_type': 'authorization_code',
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
        'code': code,
    }
    
    try:
        token_response = requests.post(token_url, data=token_data)
        token_json = token_response.json()
        
        if 'access_token' not in token_json:
            messages.error(request, '카카오 토큰 발급에 실패했습니다.')
            return redirect('accounts:login')
        
        access_token = token_json['access_token']
        
        # 카카오 사용자 정보 요청
        user_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_url, headers=headers)
        user_json = user_response.json()
        
        # 사용자 정보 추출
        kakao_id = user_json.get('id')
        kakao_account = user_json.get('kakao_account', {})
        profile = kakao_account.get('profile', {})
        
        email = kakao_account.get('email')
        
        # 닉네임 추출
        nickname = None
        if profile and 'nickname' in profile:
            nickname = profile['nickname']
        else:
            properties = user_json.get('properties', {})
            nickname = properties.get('nickname')
        
        if not nickname:
            nickname = f'kakao_user_{kakao_id}'
        
        # 사용자 생성 또는 로그인
        user = None
        username = f'kakao_{kakao_id}'
        
        # 1. 카카오 ID로 먼저 찾기 (기존 사용자)
        try:
            user = User.objects.get(username=username)
            
            # ✅ 기존 사용자의 경우 커스텀 닉네임 보존
            # 닉네임이 비어있거나 기본값인 경우에만 업데이트
            if not user.first_name or user.first_name == f'kakao_user_{kakao_id}':
                if nickname and nickname != f'kakao_user_{kakao_id}':
                    user.first_name = nickname
                    user.save()
                
        except User.DoesNotExist:
            # 2. 이메일로 찾기 (이메일이 있는 경우만)
            if email:
                try:
                    user = User.objects.get(email=email)
                    # 기존 사용자를 카카오 계정과 연결
                    user.username = username
                    # 닉네임은 기존 값이 있으면 유지
                    if not user.first_name:
                        user.first_name = nickname
                    user.save()
                except User.DoesNotExist:
                    pass
            
            # 3. 새 사용자 생성
            if not user:
                try:
                    # 고유한 이메일 생성
                    if not email:
                        timestamp = int(time.time())
                        email = f'kakao_{kakao_id}_{timestamp}@kakao.local'
                    
                    # 이메일 중복 체크
                    original_email = email
                    counter = 1
                    while User.objects.filter(email=email).exists():
                        if '@kakao.local' in original_email:
                            base_email = original_email.replace('@kakao.local', '')
                            email = f'{base_email}_{counter}@kakao.local'
                        else:
                            name, domain = original_email.split('@')
                            email = f'{name}_{counter}@{domain}'
                        counter += 1
                        if counter > 10:
                            email = f'kakao_{kakao_id}_{int(time.time())}_{counter}@kakao.local'
                            break
                    
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password=None
                    )
                    user.first_name = nickname
                    user.save()
                    
                except Exception as create_error:
                    # 마지막 수단: 완전히 고유한 이메일로 재시도
                    try:
                        unique_email = f'kakao_{kakao_id}_{int(time.time())}_{hash(str(kakao_id)) % 10000}@kakao.local'
                        user = User.objects.create_user(
                            username=username,
                            email=unique_email,
                            password=None
                        )
                        user.first_name = nickname
                        user.save()
                    except Exception as final_error:
                        messages.error(request, '사용자 생성 중 오류가 발생했습니다.')
                        return redirect('accounts:login')
        
        # 로그인 처리
        auth_login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        
        # next 파라미터 확인
        next_url = request.GET.get('next') or '/'
        return redirect(next_url)
        
    except requests.RequestException as e:
        messages.error(request, '카카오 서버와의 통신 중 오류가 발생했습니다.')
        return redirect('accounts:login')
    except Exception as e:
        messages.error(request, '카카오 로그인 처리 중 오류가 발생했습니다.')
        return redirect('accounts:login')
    
    
# 네이버 로그인 함수
def naver_login(request):
    """네이버 로그인 URL로 리다이렉트"""
    client_id = os.getenv('NAVER_OAUTH_CLIENT_ID')
    redirect_uri = os.getenv('NAVER_OAUTH_REDIRECT_URI')
    state = uuid.uuid4().hex
    
    # 세션에 state 저장 (보안을 위해)
    request.session['naver_state'] = state
    
    naver_auth_url = (
        f"https://nid.naver.com/oauth2.0/authorize"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
        f"&auth_type=reauthenticate"
        f"&prompt=consent"
    )
    
    return redirect(naver_auth_url)

def naver_callback(request):
    """네이버 로그인 콜백 처리"""
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')
    
    # 에러 확인
    if error:
        messages.error(request, '네이버 로그인이 취소되었습니다.')
        return redirect('accounts:login')
    
    if not code:
        messages.error(request, '네이버 로그인에 실패했습니다.')
        return redirect('accounts:login')
    
    # State 검증 (CSRF 방지)
    session_state = request.session.get('naver_state')
    if state != session_state:
        messages.error(request, '보안 검증에 실패했습니다.')
        return redirect('accounts:login')
    
    # 네이버 토큰 요청
    client_id = os.getenv('NAVER_OAUTH_CLIENT_ID')
    client_secret = os.getenv('NAVER_OAUTH_SECRET_ID')
    
    token_url = 'https://nid.naver.com/oauth2.0/token'
    token_data = {
        'grant_type': 'authorization_code',
        'client_id': client_id,
        'client_secret': client_secret,
        'code': code,
        'state': state,
    }
    
    try:
        token_response = requests.post(token_url, data=token_data)
        token_json = token_response.json()
        
        if 'access_token' not in token_json:
            messages.error(request, '네이버 토큰 발급에 실패했습니다.')
            return redirect('accounts:login')
        
        access_token = token_json['access_token']
        
        # 네이버 사용자 정보 요청
        user_url = 'https://openapi.naver.com/v1/nid/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_url, headers=headers)
        user_json = user_response.json()
        
        # 네이버 API 응답 확인
        if user_json.get('resultcode') != '00':
            messages.error(request, '네이버 사용자 정보 조회에 실패했습니다.')
            return redirect('accounts:login')
        
        # 사용자 정보 추출
        response_data = user_json.get('response', {})
        naver_id = response_data.get('id')
        email = response_data.get('email')
        nickname = response_data.get('nickname', f'naver_user_{naver_id}')
        name = response_data.get('name', '')
        
        # 사용자 생성 또는 로그인
        user = None
        username = f'naver_{naver_id}'
        
        # 1. 네이버 ID로 먼저 찾기 (기존 사용자)
        try:
            user = User.objects.get(username=username)
            
            # ✅ 기존 사용자의 경우 커스텀 닉네임 보존
            # 닉네임이 비어있거나 기본값인 경우에만 업데이트
            if not user.first_name or user.first_name == f'naver_user_{naver_id}':
                if nickname and nickname != f'naver_user_{naver_id}':
                    user.first_name = nickname
                    if name:
                        user.last_name = name
                    user.save()
                
        except User.DoesNotExist:
            # 2. 이메일로 찾기 (이메일이 있는 경우)
            if email:
                try:
                    user = User.objects.get(email=email)
                    # 기존 사용자를 네이버 계정과 연결
                    user.username = username
                    # 닉네임은 기존 값이 있으면 유지
                    if not user.first_name:
                        user.first_name = nickname
                    if name and not user.last_name:
                        user.last_name = name
                    user.save()
                except User.DoesNotExist:
                    pass
        
        # 3. 새 사용자 생성
        if not user:
            try:
                # 고유한 이메일 생성
                if not email:
                    timestamp = int(time.time())
                    email = f'naver_{naver_id}_{timestamp}@naver.local'
                
                # 이메일 중복 체크
                original_email = email
                counter = 1
                while User.objects.filter(email=email).exists():
                    if '@naver.local' in original_email:
                        base_email = original_email.replace('@naver.local', '')
                        email = f'{base_email}_{counter}@naver.local'
                    else:
                        name_part, domain = original_email.split('@')
                        email = f'{name_part}_{counter}@{domain}'
                    counter += 1
                    if counter > 10:
                        email = f'naver_{naver_id}_{int(time.time())}_{counter}@naver.local'
                        break
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=None
                )
                user.first_name = nickname
                if name:
                    user.last_name = name
                user.save()
            except Exception as create_error:
                messages.error(request, '사용자 생성 중 오류가 발생했습니다.')
                return redirect('accounts:login')
        
        # 로그인 처리
        auth_login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        
        # 세션에서 state 제거
        if 'naver_state' in request.session:
            del request.session['naver_state']
        
        # next 파라미터 확인
        next_url = request.GET.get('next') or '/'
        return redirect(next_url)
        
    except requests.RequestException as e:
        messages.error(request, '네이버 서버와의 통신 중 오류가 발생했습니다.')
        return redirect('accounts:login')
    except Exception as e:
        messages.error(request, '네이버 로그인 처리 중 오류가 발생했습니다.')
        return redirect('accounts:login')

def naver_logout(request):
    """네이버 완전 로그아웃 - 세션 정리 포함"""
    auth_logout(request)
    request.session.flush()
    return redirect('/')

def smart_logout(request):
    """스마트 로그아웃 - 사용자 타입에 따라 자동 선택"""
    if not request.user.is_authenticated:
        return redirect('/')
    
    username = request.user.username
    
    if username.startswith('kakao_'):
        return kakao_logout(request)
    elif username.startswith('naver_'):
        return naver_logout(request)
    else:
        return logout(request)