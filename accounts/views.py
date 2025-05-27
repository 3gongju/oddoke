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

import requests
import json

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
    return redirect('/')  # 로그아웃 후 home.html 경로로 이동


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


from django.http import JsonResponse

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
    user_profile = request.user  # 현재 로그인된 유저
    favorite_artists = Artist.objects.filter(followers=user_profile)
    favorite_members = Member.objects.filter(followers=user_profile)
    related_artists = Artist.objects.filter(members__in=favorite_members).distinct()
  
    context = {
        'user_profile': user_profile,
        'favorite_artists': favorite_artists,
        'favorite_members': favorite_members
    }
    return render(request, 'mypage.html', context)

@login_required
def edit_profile(request, username):
    user_profile = get_object_or_404(User, username=username)

    # POST 요청 처리 (프로필 이름 변경)
    if request.method == "POST":
        new_username = request.POST.get("username")
        if new_username and new_username != request.user.username:
            # 중복 유저네임 체크
            if User.objects.filter(username=new_username).exists():
                messages.error(request, "이미 존재하는 사용자 이름입니다.")
            else:
                request.user.username = new_username
                request.user.save()
                messages.success(request, "프로필 이름이 수정되었습니다.")
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
    
    

def kakao_login(request):
    # 카카오 로그인 URL로 리다이렉트
    client_id = "53d98cdd5a9bf868c96339dba7f6d3c5"  # 실제 클라이언트 ID로 변경
    redirect_uri = "http://127.0.0.1:8000/accounts/kakao/callback/"
    print(f"✅ 카카오 로그인 시작")
    
    # prompt=login 파라미터 추가로 계정 선택 화면 강제 표시
    kakao_auth_url = (
        f"https://kauth.kakao.com/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&prompt=login"  # 다른 계정으로 로그인
    )
    
    return redirect(kakao_auth_url)

# 추가: 로그아웃 시 카카오 세션도 정리하는 함수
def kakao_logout(request):
    """카카오 로그아웃 + 일반 로그아웃"""
    # 카카오 로그아웃 URL로 리다이렉트
    client_id = "53d98cdd5a9bf868c96339dba7f6d3c5"
    logout_redirect_uri = "http://127.0.0.1:8000/accounts/logout/complete/"
    
    # 일반 Django 로그아웃 먼저 처리
    auth_logout(request)
    
    # 카카오 로그아웃 URL
    kakao_logout_url = (
        f"https://kauth.kakao.com/oauth/logout"
        f"?client_id={client_id}"
        f"&logout_redirect_uri={logout_redirect_uri}"
    )
    
    return redirect(kakao_logout_url)

# 카카오 로그아웃 완료 후 처리
def logout_complete(request):
    messages.success(request, '로그아웃되었습니다.')
    return redirect('/')

def kakao_callback(request):
    
    code = request.GET.get('code')
    print(f" 받은 code: {code}")
    
    if not code:
        print("❌ 코드가 없습니다.")
        messages.error(request, '카카오 로그인에 실패했습니다.')
        return redirect('accounts:login')
    
    # 새 앱의 키 사용
    client_id = "53d98cdd5a9bf868c96339dba7f6d3c5"  # 새 앱에서 발급받은 키
    client_secret = "A7nj8NHpWlmLKm15TyrvNqjw21e7UWap"  # 보안 설정했다면 입력
    redirect_uri = "http://127.0.0.1:8000/accounts/kakao/callback/"
    
    token_url = 'https://kauth.kakao.com/oauth/token'
    token_data = {
        'grant_type': 'authorization_code',
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
        'code': code,
    }
    
    try:
        print(" 토큰 요청 시작")
        token_response = requests.post(token_url, data=token_data)
        token_json = token_response.json()
        print(f" 토큰 응답: {token_json}")
        
        if 'access_token' not in token_json:
            print(f"❌ 토큰 발급 실패: {token_json}")
            messages.error(request, '카카오 토큰 발급에 실패했습니다.')
            return redirect('accounts:login')
        
        access_token = token_json['access_token']
        print(f"✅ 액세스 토큰 획득: {access_token[:20]}...")
        
        # 카카오 사용자 정보 요청
        user_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_url, headers=headers)
        user_json = user_response.json()
        print(f"👤 사용자 정보: {user_json}")
        
        # 사용자 정보 추출
        kakao_id = user_json.get('id')
        kakao_account = user_json.get('kakao_account', {})
        profile = kakao_account.get('profile', {})
        
        email = kakao_account.get('email')
        nickname = profile.get('nickname', f'kakao_user_{kakao_id}')
        print(f" 이메일: {email}, 닉네임: {nickname}")
        
        # 사용자 생성 또는 로그인
        print(" 사용자 찾기/생성 시작")
        
        user = None
        username = f'kakao_{kakao_id}'
        
        # 1. 카카오 ID로 먼저 찾기
        try:
            user = User.objects.get(username=username)
            print(f"✅ 기존 카카오 사용자 발견: {user.username}")
        except User.DoesNotExist:
            print("👤 카카오 사용자가 존재하지 않음")
            
            # 2. 이메일로 찾기 (이메일이 있는 경우)
            if email:
                try:
                    user = User.objects.get(email=email)
                    print(f" 이메일로 기존 사용자 발견: {user.username}")
                    # 기존 사용자를 카카오 계정과 연결
                    user.username = username
                    user.first_name = nickname
                    user.save()
                    print("🔗 기존 사용자와 카카오 계정 연결 완료")
                except User.DoesNotExist:
                    print(" 이메일로도 사용자를 찾을 수 없음")
        
        # 3. 새 사용자 생성
        if not user:
            print(" 새 카카오 사용자 생성 중...")
            try:
                user = User.objects.create_user(
                    username=username,
                    email=email or f'{username}@kakao.local',
                    password=None  # 소셜 로그인은 비밀번호 없음
                )
                user.first_name = nickname
                user.save()
                print(f"✅ 새 사용자 생성 완료: {user.username}")
            except Exception as create_error:
                print(f"❌ 사용자 생성 실패: {create_error}")
                messages.error(request, '사용자 생성 중 오류가 발생했습니다.')
                return redirect('accounts:login')
        
        # 로그인 처리
        print("🔐 로그인 처리 시작")
        auth_login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        print(f" 로그인 성공: {user.username}")
        
        messages.success(request, f'{nickname}님, 카카오 로그인 성공!')
        
        # next 파라미터 확인
        next_url = request.GET.get('next') or '/'
        print(f" 리다이렉트: {next_url}")
        return redirect(next_url)
        
    except requests.RequestException as e:
        print(f"❌ 네트워크 오류: {e}")
        messages.error(request, '카카오 서버와의 통신 중 오류가 발생했습니다.')
        return redirect('accounts:login')
    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        messages.error(request, '카카오 로그인 처리 중 오류가 발생했습니다.')
        return redirect('accounts:login')