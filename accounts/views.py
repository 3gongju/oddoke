from django.shortcuts import get_object_or_404, render, redirect
from .forms import CustomUserCreationForm, CustomAuthenticationForm, MannerReviewForm, ProfileImageForm
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from .models import User, MannerReview
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost
from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost
from artist.models import Artist, Member
from itertools import chain
from django.utils.timezone import now
from dotenv import load_dotenv

import uuid
import requests
import json
import os
import time

load_dotenv()

from django.http import JsonResponse


# Create your views here.
def signup(request):
    preview_image_url = None

    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save()
            
            if user.profile_image:
                preview_image_url = user.profile_image.url

            return redirect('accounts:login')
    else:
        form = CustomUserCreationForm()
    
    context = {
        'form': form,
    }

    return render(request, 'signup.html', context)

def login(request):
    if request.method == 'POST':
        form = CustomAuthenticationForm(request, request.POST)
        if form.is_valid():
            user = form.get_user()
            auth_login(request, user)

            # next 파라미터 우선 적용
            next_url = request.GET.get('next') or '/'
            return redirect(next_url)
    else:
        form = CustomAuthenticationForm()

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

    # 리뷰 작성
    if request.method == 'POST':
        form = MannerReviewForm(request.POST)
        if form.is_valid():
            review = form.save(commit=False)
            review.user = request.user
            review.target_user = user_profile
            review.save()
            return redirect('accounts:review_home', username=username)
    else:
        form = MannerReviewForm()

    reviews = MannerReview.objects.filter(target_user=user_profile).order_by('-created_at')

    return render(request, 'accounts/review_home.html', {
        'user_profile': user_profile,
        'form': form,
        'reviews': reviews
    })

def mypage(request):
    user_profile = request.user
    favorite_artists = Artist.objects.filter(followers=user_profile)
    favorite_members = Member.objects.filter(followers=user_profile)
    followed_artist_ids = list(favorite_artists.values_list('id', flat=True))

    # 각 멤버별로 유저가 팔로우한 아티스트 중 하나를 연결
    for member in favorite_members:
        matched = next(
            (artist for artist in member.artist_name.all() if artist.id in followed_artist_ids),
            None
        )
        member.matched_artist = matched  # 템플릿에서 접근할 수 있음

        member.filtered_artists = [
        artist for artist in member.artist_name.all() if artist.id in followed_artist_ids
        ]

    context = {
        'user_profile': user_profile,
        'favorite_artists': favorite_artists,
        'favorite_members': favorite_members,
        'followed_artist_ids': json.dumps(followed_artist_ids),
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
    
    
# 카카오 로그인 관련 뷰
def kakao_login(request):
    client_id = os.getenv('KAKAO_OAUTH_CLIENT_ID')
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
    client_id = os.getenv('KAKAO_OAUTH_CLIENT_ID')
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
    
    client_id = os.getenv('KAKAO_OAUTH_CLIENT_ID')
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