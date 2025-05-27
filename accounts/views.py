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
        # ✅ 1. 사용자 이름 변경 처리
        new_username = request.POST.get("username")
        if new_username and new_username != request.user.username:
            if User.objects.filter(username=new_username).exists():
                messages.error(request, "이미 존재하는 사용자 이름입니다.")
                return redirect('accounts:edit_profile', username=username)
            else:
                request.user.username = new_username
                request.user.save()
                messages.success(request, "프로필 이름이 수정되었습니다.")
                return redirect('accounts:edit_profile', username=request.user.username)

        # ✅ 2. 소개(bio) 수정 처리
        new_bio = request.POST.get("bio")
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
