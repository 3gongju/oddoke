import json
import os
import time
from itertools import chain
from collections import Counter
from PIL import Image, ExifTags
from dotenv import load_dotenv

from ddoksang.views.base_views import get_recent_cafes_objects

from django.shortcuts import get_object_or_404, render, redirect
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils.timezone import now
from django.http import JsonResponse, Http404
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator

from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment
from ddokchat.models import ChatRoom 
from artist.models import Artist, Member

from .models import User, MannerReview, FandomProfile, BankProfile, AddressProfile, PostReport, BannerRequest, DdokPointLog, SocialAccount, UserSuspension
from .forms import CustomUserCreationForm, EmailAuthenticationForm, MannerReviewForm, ProfileImageForm, BankForm, AddressForm, SocialSignupCompleteForm, PostReportForm, BannerRequestForm
from .services import KakaoAuthService, NaverAuthService, GoogleAuthService

from django.views.decorators.http import require_POST, require_GET
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.views import (
    PasswordResetView, PasswordResetDoneView, 
    PasswordResetConfirmView, PasswordResetCompleteView
)
from django.urls import reverse_lazy
from django.contrib import messages
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.contrib.auth import get_user_model
from .forms import CustomPasswordResetForm, CustomSetPasswordForm

from django.db import transaction
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

load_dotenv()

# 비밀번호 재설정 뷰들
class CustomPasswordResetView(PasswordResetView):
    template_name = 'accounts/password_reset.html'
    form_class = CustomPasswordResetForm
    success_url = reverse_lazy('accounts:password_reset_done')
    email_template_name = 'emails/password_reset_email.html'  # 다시 HTML로
    subject_template_name = 'emails/password_reset_subject.txt'
    
    def form_valid(self, form):
        email = form.cleaned_data['email']
        print(f"비밀번호 재설정 요청 이메일: {email}")
        
        # 해당 이메일로 사용자가 존재하는지 확인
        try:
            user = User.objects.get(email=email, is_active=True)
            print(f"사용자 찾음: {user.username}")
            response = super().form_valid(form)
            print("이메일 전송 완료")
            messages.success(
                self.request, 
                '비밀번호 재설정 이메일이 전송되었습니다. 이메일을 확인해주세요.'
            )
            return response
        except User.DoesNotExist:
            print("사용자 없음, 하지만 성공 메시지 표시")
            messages.success(
                self.request, 
                '해당 이메일로 계정이 존재한다면 비밀번호 재설정 이메일이 전송되었습니다.'
            )
            return super().form_valid(form)

class CustomPasswordResetDoneView(PasswordResetDoneView):
    template_name = 'accounts/password_reset_sent.html'

class CustomPasswordResetConfirmView(PasswordResetConfirmView):
    template_name = 'accounts/password_reset_confirm.html'
    form_class = CustomSetPasswordForm
    success_url = reverse_lazy('accounts:password_reset_complete')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # 사용자 정보를 컨텍스트에 추가
        try:
            uid = urlsafe_base64_decode(self.kwargs['uidb64']).decode()
            user = User.objects.get(pk=uid)
            context['user'] = user
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            context['user'] = None
        return context
    
    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(
            self.request, 
            '비밀번호가 성공적으로 변경되었습니다. 새로운 비밀번호로 로그인해주세요.'
        )
        return response

class CustomPasswordResetCompleteView(PasswordResetCompleteView):
    template_name = 'accounts/password_reset_complete.html'

def signup(request):
    preview_image_url = None

    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST, request.FILES)
        if form.is_valid():
            # 한 번만 저장하도록
            user = form.save()  # 이미 form의 save 메서드에서 is_active=False 처리됨
            
            if user.profile_image:
                preview_image_url = user.profile_image.url

            # 이메일 인증 토큰 생성
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            activation_link = request.build_absolute_uri(
                f'/accounts/activate/{uid}/{token}/'
            )

            # HTML 이메일 내용 렌더링
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

            # 특별한 태그를 가진 메시지로 변경
            messages.add_message(
                request, 
                messages.SUCCESS, 
                '인증 이메일이 전송되었습니다!\n이메일을 확인해주세요.',
                extra_tags='modal_required'  # 특별 태그 추가
            )
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
        
        # 이메일 인증 완료 = 회원가입 완료이므로 바로 로그인 처리 후 아티스트 페이지로
        auth_login(request, user)
        
        messages.success(
            request,
            f'환영합니다, {user.username}님! 이메일 인증이 완료되었습니다.'
        )
        return redirect('artist:index')
    else:
        messages.error(request, '인증 링크가 유효하지 않거나 만료되었습니다.')
        return redirect('accounts:login')

def login(request):
    if request.method == 'POST':
        form = EmailAuthenticationForm(request.POST)
        if form.is_valid():
            user = form.get_user()

            if not user.is_active:
                messages.warning(request, "이메일 인증이 필요합니다.\n이메일을 확인해주세요!")
                return render(request, 'login.html', {'form': form})

            auth_login(request, user)
            
            # 첫 로그인인지 따지지않음으로 수정완료
            next_url = request.GET.get('next') or '/'
            return redirect(next_url)
    else:
        form = EmailAuthenticationForm()

    return render(request, 'login.html', {'form': form})


@login_required
def logout(request):
    auth_logout(request)
    request.session.flush()
    return redirect('/')

@login_required
def profile(request, username):
    user_profile = User.objects.get(username=username)
    fandom_profile = user_profile.get_fandom_profile() # 팬덤 프로필 추가

    # 덕담 게시글 모두 가져오기
    community_posts = DamCommunityPost.objects.filter(user=user_profile)
    manner_posts = DamMannerPost.objects.filter(user=user_profile)
    bdaycafe_posts = DamBdaycafePost.objects.filter(user=user_profile)
    ddokdam_posts = sorted(
        chain(community_posts, manner_posts, bdaycafe_posts),
        key=lambda post: post.created_at,
        reverse=True
    )
    # 덕팜 게시글 모두 가져오기 
    sell_posts = FarmSellPost.objects.filter(user=user_profile)
    rental_posts = FarmRentalPost.objects.filter(user=user_profile)
    split_posts = FarmSplitPost.objects.filter(user=user_profile)
    ddokfarm_posts = sorted(
        chain(sell_posts, rental_posts, split_posts),
        key=lambda post: post.created_at,
        reverse=True
    )
    # 찜한 아티스트 가져오기
    favorite_artists = Artist.objects.filter(followers=user_profile)

    # 팔로우 여부 판단
    is_following = False
    if request.user.is_authenticated and request.user != user_profile:
        is_following = user_profile.followers.filter(id=request.user.id).exists()

    return render(request, 'profile.html', {
        'user_profile': user_profile,
        'fandom_profile': fandom_profile,
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
            chatroom_code = request.POST.get('chatroom_code')

            if chatroom_code:
                try:
                    chatroom = ChatRoom.objects.get(room_code=chatroom_code)
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

    # 상세 항목별 카운터 수집
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

    # 최대값 계산 (막대 너비 비율용)
    max_counts = {
        'rating': max(rating_counter.values(), default=1),
        'description': max(description_counter.values(), default=1),
        'response': max(response_counter.values(), default=1),
        'politeness': max(politeness_counter.values(), default=1),
        'deal_again': max(deal_again_counter.values(), default=1),
    }

    # JavaScript에서 사용할 수 있도록 JSON 변환
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
    
    # 새로운 방식: 각 프로필 가져오기
    fandom_profile = user_profile.get_fandom_profile()
    bank_profile = user_profile.get_bank_profile()
    address_profile = user_profile.get_address_profile()
    
    favorite_artists = Artist.objects.filter(followers=user_profile)
    favorite_members = Member.objects.filter(followers=user_profile)
    followed_artist_ids = list(favorite_artists.values_list('id', flat=True))

    #🎯 덕 포인트 정보 추가
    try:
        user_ddok_point = request.user.ddok_point
        total_ddok_points = user_ddok_point.total_points
        
        # 최근 5개 내역만 가져오기 (더보기에서 표시할 최대 개수)
        recent_ddok_history = user_ddok_point.logs.select_related('related_member').order_by('-created_at')[:5]
        
        print(f"🎯 마이페이지 덕 포인트: {total_ddok_points}")
        print(f"🎯 최근 내역 개수: {recent_ddok_history.count()}")
        
    except Exception as e:
        print(f"🎯 덕 포인트 조회 오류: {e}")
        total_ddok_points = 0
        recent_ddok_history = []

    # 내가 쓴 글 (Farm)
    farm_posts = sorted(
        chain(
            FarmSellPost.objects.filter(user=user_profile),
            FarmRentalPost.objects.filter(user=user_profile),
            FarmSplitPost.objects.filter(user=user_profile)
        ),
        key=lambda post: post.created_at,
        reverse=True
    )

    # 내가 쓴 글 (Dam)
    dam_posts = sorted(
        chain(
            DamCommunityPost.objects.filter(user=user_profile),
            DamMannerPost.objects.filter(user=user_profile),
            DamBdaycafePost.objects.filter(user=user_profile)
        ),
        key=lambda post: post.created_at,
        reverse=True
    )

    # 내가 찜한 글 (Farm)
    liked_farm_posts = sorted(
        chain(
            FarmSellPost.objects.filter(like=user_profile),
            FarmRentalPost.objects.filter(like=user_profile),
            FarmSplitPost.objects.filter(like=user_profile)
        ),
        key=lambda post: post.created_at,
        reverse=True
    )

    # 내가 찜한 글 (Dam)
    liked_dam_posts = sorted(
        chain(
            DamCommunityPost.objects.filter(like=user_profile),
            DamMannerPost.objects.filter(like=user_profile),
            DamBdaycafePost.objects.filter(like=user_profile)
        ),
        key=lambda post: post.created_at,
        reverse=True
    )

    # 내가 쓴 댓글 (Farm, 상위 댓글만)
    farm_comments = FarmComment.objects.filter(user=user_profile, parent__isnull=True)
    dam_comments = DamComment.objects.filter(user=user_profile, parent__isnull=True)

    # 댓글에 연결된 게시글 및 카테고리 추출
    for comment in chain(farm_comments, dam_comments):
        target_model = comment.content_type.model_class()
        target_post = target_model.objects.filter(id=comment.object_id).first()
        comment.target_post = target_post
        comment.category = getattr(target_post, 'category_type', None)

    # 덕생(생일카페) 관련 데이터
    from ddoksang.models import BdayCafe
    
    # 내가 등록한 생일카페
    my_cafes = BdayCafe.objects.filter(submitted_by=user_profile).order_by('-created_at')
    
    # 찜한 생일카페
    favorite_cafes = user_profile.favorite_cafes.order_by('-created_at')
    
    # 최근 본 생일카페 (최대 20개, 최근 순)    
    recent_cafes = get_recent_cafes_objects(request)

    
    # 덕생 통계
    cafe_stats = {
        'total': my_cafes.count(),
        'pending': my_cafes.filter(status='pending').count(),
        'approved': my_cafes.filter(status='approved').count(), 
        'rejected': my_cafes.filter(status='rejected').count(),
    }
    
    # 멤버-아티스트 매핑
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
        'fandom_profile': fandom_profile,      # 추가
        'bank_profile': bank_profile,          # 추가 
        'address_profile': address_profile,    # 추가
        'favorite_artists': favorite_artists,
        'favorite_members': favorite_members,
        'followed_artist_ids': json.dumps(followed_artist_ids),
        'farm_posts': farm_posts,              # 내가 쓴 글
        'liked_farm_posts': liked_farm_posts,  # 내가 찜한 글
        'farm_comments': farm_comments,        # 내가 쓴 댓글
        'dam_posts': dam_posts,                # 내가 쓴 글
        'liked_dam_posts': liked_dam_posts,    # 내가 찜한 글
        'dam_comments': dam_comments,          # 내가 쓴 댓글
        'my_reviews': my_reviews,              # 내가 쓴 리뷰
        #  덕생 관련 데이터 
        'my_cafes': my_cafes,                  # 내가 등록한 카페
        'favorite_cafes': favorite_cafes,      # 찜한 카페
        'recent_cafes': recent_cafes,          # 최근 본 카페
        'cafe_stats': cafe_stats,              # 덕생 통계
        'total_ddok_points': total_ddok_points,     # 총 덕 포인트
        'recent_ddok_history': recent_ddok_history, # 최근 내역
    }
    return render(request, 'mypage.html', context)

@login_required
def settings_main(request, username):
    """설정 메인 페이지 (새로 추가)"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 정보만 확인할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 필요한 프로필 정보들 가져오기 (기존 mypage 로직 활용)
    fandom_profile = user_profile.get_fandom_profile()
    bank_profile = user_profile.get_bank_profile()
    address_profile = user_profile.get_address_profile()
    
    context = {
        'user_profile': user_profile,
        'fandom_profile': fandom_profile,
        'bank_profile': bank_profile,
        'address_profile': address_profile,
    }
    return render(request, 'accounts/settings_main.html', context)

@login_required
def edit_profile_info(request, username):
    """회원 정보 수정 - 간소화된 버전"""
    user_profile = get_object_or_404(User, username=username)

    if request.method == "POST":
        new_username = request.POST.get("username")
        new_bio = request.POST.get("bio")

        # 🔥 username 변경 (모든 사용자 동일하게 처리)
        if new_username and new_username != request.user.username:
            new_username = new_username.strip()
            
            if len(new_username) < 2:
                messages.error(request, "닉네임은 최소 2자 이상이어야 합니다.")
                return redirect('accounts:edit_profile_info', username=request.user.username)
            
            if len(new_username) > 20:
                messages.error(request, "닉네임은 최대 20자까지 입력 가능합니다.")
                return redirect('accounts:edit_profile_info', username=request.user.username)
            
            if User.objects.filter(username=new_username).exists():
                messages.error(request, "이미 존재하는 닉네임입니다.")
                return redirect('accounts:edit_profile_info', username=request.user.username)
            
            # username 업데이트
            request.user.username = new_username
            request.user.save()
            messages.success(request, "닉네임이 수정되었습니다.")
            return redirect('accounts:edit_profile_info', username=request.user.username)

        # 소개 수정
        if new_bio is not None and new_bio != request.user.bio:
            request.user.bio = new_bio
            request.user.save()
            messages.success(request, "소개가 수정되었습니다.")
            return redirect('accounts:edit_profile_info', username=request.user.username)

    fandom_profile = user_profile.get_fandom_profile()

    context = {
        'user_profile': user_profile,
        'fandom_profile': fandom_profile,
        'artist_list': Artist.objects.all(),
    }
    return render(request, 'accounts/edit_profile_info.html', context)


@login_required
def edit_profile_image(request, username):
    user = get_object_or_404(User, username=username)
    if request.user != user:
        return redirect('accounts:profile', username=username)

    if request.method == 'POST':
        form = ProfileImageForm(request.POST, request.FILES, instance=user)
        if form.is_valid():
            form.save()
            return redirect('accounts:edit_profile_info', username=username)
    else:
        form = ProfileImageForm(instance=user)

    return render(request, 'accounts/edit_profile_image.html', {
        'form': form,
        'user_profile': user,
    })

@login_required
def upload_fandom_card(request, username):
    """🔥 수정: null/blank 제거에 따른 필수 필드 검증 강화"""
    user = get_object_or_404(User, username=username)

    if request.method == 'POST':
        image = request.FILES.get('fandom_card')
        artist_id = request.POST.get('artist_id')
        # 인증 기간 필드 추가
        verification_start_date = request.POST.get('verification_start_date')
        verification_end_date = request.POST.get('verification_end_date')

        # 🔥 필수 필드 검증 강화
        if not image:
            messages.error(request, '팬덤 카드 이미지를 업로드해주세요.')
            return redirect('accounts:settings_main', username=username)
        
        if not artist_id:
            messages.error(request, '아티스트를 선택해주세요.')
            return redirect('accounts:settings_main', username=username)
            
        if not verification_start_date:
            messages.error(request, '인증 시작일을 입력해주세요.')
            return redirect('accounts:settings_main', username=username)
            
        if not verification_end_date:
            messages.error(request, '인증 만료일을 입력해주세요.')
            return redirect('accounts:settings_main', username=username)

        try:
            img = Image.open(image)
            
            # EXIF 데이터로 회전 정보 확인 및 수정
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
            except (AttributeError, KeyError, TypeError):
                pass
            
            # 이미지 비율 계산
            width, height = img.size
            uploaded_ratio = width / height if height > 0 else 0

        except Exception as e:
            messages.error(request, f'이미지를 처리할 수 없습니다: {str(e)}')
            return redirect('accounts:settings_main', username=username)

        # 🔥 지연 생성 방식: 모든 필드가 준비된 후 생성
        try:
            from datetime import datetime
            
            # 기존 프로필이 있다면 삭제 (재인증)
            existing_profile = user.get_fandom_profile()
            if existing_profile:
                existing_profile.delete()
            
            # 새로운 완전한 프로필 생성
            fandom_profile = FandomProfile.objects.create(
                user=user,
                fandom_card=image,
                fandom_artist=get_object_or_404(Artist, id=artist_id),
                verification_start_date=datetime.strptime(verification_start_date, '%Y-%m-%d').date(),
                verification_end_date=datetime.strptime(verification_end_date, '%Y-%m-%d').date(),
                applied_at=now(),
                is_verified_fandom=False,
                is_pending_verification=True,
                verification_failed=False
            )
            
            messages.success(request, '공식 팬덤 인증 확인 중입니다. (3일 소요)')
            return redirect('accounts:settings_main', username=username)
            
        except Exception as e:
            messages.error(request, f'팬덤 프로필 생성 중 오류가 발생했습니다: {str(e)}')
            return redirect('accounts:settings_main', username=username)

# 기존 계좌 인증 함수들을 간소화된 버전으로 교체
@login_required
def bank_registration(request, username):
    """🔥 수정: 계좌 정보 등록 - 필수 필드 검증 강화"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 등록할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 이미 등록된 계좌가 있는지 확인
    bank_profile = user_profile.get_bank_profile()
    if bank_profile:
        messages.info(request, '이미 등록된 계좌가 있습니다.')
        return redirect('accounts:bank_settings', username=username)  
    
    if request.method == 'POST':
        print("POST 요청 받음")
        form = BankForm(request.POST)
        print(f"폼 데이터: {request.POST}")
        
        if form.is_valid():
            print("폼 유효성 검사 통과")
            print(f"cleaned_data: {form.cleaned_data}")
            try:
                # 🔥 지연 생성 방식: 모든 필드가 검증된 후 생성
                bank_profile = BankProfile.objects.create(
                    user=user_profile,
                    bank_code=form.cleaned_data['bank_code'],
                    bank_name=dict(form.BANK_CHOICES)[form.cleaned_data['bank_code']],
                    bank_number=form.cleaned_data['bank_number'],  # 암호화는 setter에서 처리
                    bank_holder=form.cleaned_data['bank_holder']
                )
                print(f"저장 성공: {bank_profile}")
                messages.success(request, '계좌 정보가 등록되었습니다!')
                return redirect('accounts:bank_settings', username=username)  
            except Exception as e:
                print(f"저장 실패: {str(e)}")
                messages.error(request, f'계좌 등록 중 오류가 발생했습니다: {str(e)}')
        else:
            print(f"폼 에러: {form.errors}")
    else:
        form = BankForm()
    
    context = {
        'form': form,
        'user_profile': user_profile,
    }
    return render(request, 'accounts/bank_registration.html', context)

@login_required  
def bank_modify(request, username):
    """등록된 계좌정보 수정"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 수정할 수 있습니다.')
        return redirect('accounts:mypage')
    
    bank_profile = user_profile.get_bank_profile()
    if not bank_profile:
        messages.warning(request, '등록된 계좌가 없습니다. 먼저 계좌를 등록해주세요.')
        return redirect('accounts:bank_registration', username=username)
    
    if request.method == 'POST':
        form = BankForm(request.POST)
        if form.is_valid():
            try:
                # 기존 계좌 정보 업데이트
                bank_profile.bank_code = form.cleaned_data['bank_code']
                bank_profile.bank_name = dict(form.BANK_CHOICES)[form.cleaned_data['bank_code']]
                bank_profile.bank_number = form.cleaned_data['bank_number']
                bank_profile.bank_holder = form.cleaned_data['bank_holder']
                bank_profile.save()
                
                messages.success(request, '계좌정보가 수정되었습니다!')
                return redirect('accounts:bank_settings', username=username)  
            except Exception as e:
                messages.error(request, f'계좌 수정 중 오류가 발생했습니다: {str(e)}')
    else:
        # 기존 정보로 폼 초기화
        initial_data = {
            'bank_code': bank_profile.bank_code,
            'bank_number': bank_profile.bank_number,
            'bank_holder': bank_profile.bank_holder,
        }
        form = BankForm(initial=initial_data)
    
    context = {
        'form': form,
        'user_profile': user_profile,
        'bank_profile': bank_profile,
        'is_modify': True,
    }
    return render(request, 'accounts/bank_registration.html', context)

@login_required
def bank_delete(request, username):
    """등록된 계좌정보 삭제"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 삭제할 수 있습니다.')
        return redirect('accounts:mypage')
    
    bank_profile = user_profile.get_bank_profile()
    if not bank_profile:
        messages.warning(request, '등록된 계좌가 없습니다.')
        return redirect('accounts:bank_settings', username=username)  
    
    if request.method == 'POST':
        bank_profile.delete()
        messages.success(request, '계좌정보가 삭제되었습니다.')
        return redirect('accounts:bank_settings', username=username)  
    
    context = {
        'user_profile': user_profile,
        'bank_profile': bank_profile,
    }
    return render(request, 'accounts/bank_delete_confirm.html', context)


@login_required
def address_registration(request, username):
    """🔥 수정: 주소 정보 등록 - 필수 필드 검증 강화"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 주소만 등록할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 이미 등록된 주소가 있는지 확인
    address_profile = user_profile.get_address_profile()
    if address_profile:
        messages.info(request, '이미 등록된 배송정보가 있습니다.')
        return redirect('accounts:address_settings', username=username)  
    
    if request.method == 'POST':
        form = AddressForm(request.POST)
        if form.is_valid():
            try:
                # 🔥 지연 생성 방식: 모든 필드가 검증된 후 생성
                address_profile = AddressProfile.objects.create(
                    user=user_profile,
                    postal_code=form.cleaned_data['postal_code'],  # 암호화는 setter에서 처리
                    road_address=form.cleaned_data['road_address'],
                    detail_address=form.cleaned_data['detail_address'],
                    phone_number=form.cleaned_data['phone_number'],
                    sido=form.cleaned_data['sido'],
                    sigungu=form.cleaned_data['sigungu']
                )
                messages.success(request, '배송정보가 등록되었습니다!')
                return redirect('accounts:address_settings', username=username) 
            except Exception as e:
                messages.error(request, f'배송정보 등록 중 오류가 발생했습니다: {str(e)}')
    else:
        form = AddressForm()
    
    context = {
        'form': form,
        'user_profile': user_profile,
    }
    return render(request, 'accounts/address_registration.html', context)

@login_required  
def address_modify(request, username):
    """등록된 주소정보 수정 - 핸드폰 번호 포함"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 주소만 수정할 수 있습니다.')
        return redirect('accounts:mypage')
    
    address_profile = user_profile.get_address_profile()
    if not address_profile:
        messages.warning(request, '등록된 주소가 없습니다. 먼저 주소를 등록해주세요.')
        return redirect('accounts:address_registration', username=username)
    
    if request.method == 'POST':
        form = AddressForm(request.POST)
        if form.is_valid():
            try:
                # 기존 주소 정보 업데이트 - 핸드폰 번호 포함
                address_profile.postal_code = form.cleaned_data['postal_code']
                address_profile.road_address = form.cleaned_data['road_address']
                address_profile.detail_address = form.cleaned_data['detail_address']
                address_profile.phone_number = form.cleaned_data['phone_number']  
                address_profile.sido = form.cleaned_data['sido']
                address_profile.sigungu = form.cleaned_data['sigungu']
                address_profile.save()
                
                messages.success(request, '배송정보가 수정되었습니다!')
                return redirect('accounts:address_settings', username=username)  
            except Exception as e:
                messages.error(request, f'배송정보 수정 중 오류가 발생했습니다: {str(e)}')
    else:
        # 기존 정보로 폼 초기화 - 핸드폰 번호 포함
        initial_data = {
            'postal_code': address_profile.postal_code,
            'road_address': address_profile.road_address,
            'detail_address': address_profile.detail_address,
            'phone_number': address_profile.phone_number,  # 핸드폰 번호 추가
            'sido': address_profile.sido,
            'sigungu': address_profile.sigungu,
        }
        form = AddressForm(initial=initial_data)
    
    context = {
        'form': form,
        'user_profile': user_profile,
        'address_profile': address_profile,
        'is_modify': True,
    }
    return render(request, 'accounts/address_registration.html', context)

@login_required
def address_delete(request, username):
    """등록된 주소정보 삭제"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 주소만 삭제할 수 있습니다.')
        return redirect('accounts:mypage')
    
    address_profile = user_profile.get_address_profile()
    if not address_profile:
        messages.warning(request, '등록된 주소가 없습니다.')
        return redirect('accounts:address_settings', username=username) 
    
    if request.method == 'POST':
        address_profile.delete()
        messages.success(request, '배송정보가 삭제되었습니다.')
        return redirect('accounts:address_settings', username=username) 
    
    context = {
        'user_profile': user_profile,
        'address_profile': address_profile,
    }
    return render(request, 'accounts/address_delete_confirm.html', context)

@login_required
def social_signup_complete(request):
    """🔥 수정: 소셜 로그인 후 username 설정 페이지 - SocialAccount 모델 사용"""
    
    print(f"social_signup_complete 진입: {request.user.username}")
    
    # 🔥 SocialAccount 모델을 통해 가입 완료 여부 확인
    social_account = request.user.get_social_account()
    if social_account and social_account.signup_completed:
        print("이미 프로필 완성됨 → 메인으로")
        return redirect('/')
    
    if request.method == 'POST':
        print("POST 처리 시작")
        form = SocialSignupCompleteForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            print("폼 유효성 검사 통과")
            try:
                user = form.save()
                
                # 🔥 SocialAccount에서 가입 완료 표시
                if social_account:
                    social_account.signup_completed = True
                    social_account.save()
                
                messages.success(request, f'환영합니다, {user.username}님!')
                return redirect('artist:index')
                
            except Exception as e:
                import traceback
                traceback.print_exc()
                messages.error(request, f'저장 중 오류: {str(e)}')
        else:
            messages.error(request, '입력 정보를 확인해주세요.')
    else:
        form = SocialSignupCompleteForm(instance=request.user)
    
    return render(request, 'accounts/social_signup_complete.html', {'form': form})

# 카카오 로그인
def kakao_login(request):
    """카카오 로그인 페이지로 리다이렉트"""
    service = KakaoAuthService()
    auth_url = service.get_auth_url()
    return redirect(auth_url)

def kakao_callback(request):
    """🔥 수정: 카카오 로그인 콜백 처리 - SocialAccount 모델 사용"""
    print("=== 카카오 콜백 디버깅 ===")
    
    code = request.GET.get('code')
    if not code:
        print("카카오 코드 없음")
        messages.error(request, '카카오 로그인에 실패했습니다.')
        return redirect('accounts:login')
    
    print(f"카카오 코드 받음: {code[:10]}...")
    
    service = KakaoAuthService()
    
    try:
        print("카카오 콜백 처리 시작...")
        user = service.handle_callback(code)
        print(f"반환된 사용자: {user.username}")
        print(f"사용자 이메일: {user.email}")
        
        # 🔥 SocialAccount 모델을 통해 소셜 상태 확인
        social_account = user.get_social_account()
        print(f"소셜 계정: {social_account}")
        print(f"가입 완료 여부: {social_account.signup_completed if social_account else 'N/A'}")
        
        # 이메일 기반 인증 (패스워드 없이)
        from django.contrib.auth import authenticate
        print("이메일 기반 인증 시도...")
        authenticated_user = authenticate(
            request, 
            email=user.email, 
            password=None
        )
        print(f"인증 결과: {authenticated_user}")
        
        if authenticated_user:
            print("인증 성공, 로그인 처리...")
            auth_login(request, authenticated_user, backend='accounts.backends.EmailBackend')
            print(f"로그인 성공: {request.user.is_authenticated}")
            
            # 🔥 SocialAccount를 통해 프로필 완성 여부 확인
            social_account = authenticated_user.get_social_account()
            if not social_account or not social_account.signup_completed:
                print("신규 사용자 또는 미완성 프로필 → 프로필 완성 페이지로")
                return redirect('accounts:social_signup_complete')
            else:
                print(f"기존 완성된 사용자 → 메인으로 ({authenticated_user.display_name})")
                messages.success(request, f'환영합니다, {authenticated_user.display_name}님!')
                
            next_url = request.GET.get('next') or '/'
            print(f"리다이렉트 URL: {next_url}")
            return redirect(next_url)
        else:
            print("인증 실패!")
            messages.error(request, '카카오 로그인 인증에 실패했습니다.')
            return redirect('accounts:login')
        
    except Exception as e:
        print(f"전체 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # 이메일 중복 에러 처리
        if '이미' in str(e) and '가입된 계정' in str(e):
            messages.error(request, str(e))
        else:
            messages.error(request, f'카카오 로그인 처리 중 오류가 발생했습니다: {str(e)}')
        return redirect('accounts:login')

def kakao_logout(request):
    """카카오 로그아웃 + 일반 로그아웃"""
    service = KakaoAuthService()
    
    # 일반 로그아웃 먼저 처리
    auth_logout(request)
    
    # 카카오 로그아웃 URL로 리다이렉트
    logout_url = service.get_logout_url()
    return redirect(logout_url)

# 네이버 로그인
def naver_login(request):
    """네이버 로그인 페이지로 리다이렉트"""
    service = NaverAuthService()
    auth_url, state = service.get_auth_url()
    
    # 세션에 state 저장 (보안을 위해)
    request.session['naver_state'] = state
    
    return redirect(auth_url)

def naver_callback(request):
    """🔥 수정: 네이버 로그인 콜백 처리 - SocialAccount 모델 사용"""
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
    service = NaverAuthService()
    session_state = request.session.get('naver_state')
    
    if not service.validate_state(state, session_state):
        messages.error(request, '보안 검증에 실패했습니다.')
        return redirect('accounts:login')
    
    try:
        user = service.handle_callback(code, state)
        print(f"반환된 사용자: {user.username}")
        print(f"사용자 이메일: {user.email}")
        
        # 🔥 SocialAccount 모델을 통해 소셜 상태 확인
        social_account = user.get_social_account()
        print(f"소셜 계정: {social_account}")
        print(f"가입 완료 여부: {social_account.signup_completed if social_account else 'N/A'}")
        
        # 이메일 기반 인증 (패스워드 없이)
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(
            request, 
            email=user.email, 
            password=None
        )
        
        if authenticated_user:
            auth_login(request, authenticated_user, backend='accounts.backends.EmailBackend')
            
            # 세션에서 state 제거
            if 'naver_state' in request.session:
                del request.session['naver_state']
            
            # 🔥 SocialAccount를 통해 프로필 완성 여부 확인
            social_account = authenticated_user.get_social_account()
            if not social_account or not social_account.signup_completed:
                print("신규 사용자 또는 미완성 프로필 → 프로필 완성 페이지로")
                return redirect('accounts:social_signup_complete')
            else:
                print(f"기존 완성된 사용자 → 메인으로 ({authenticated_user.display_name})")
                messages.success(request, f'환영합니다, {authenticated_user.display_name}님!')
            
            # 기존 사용자면 next 파라미터 확인 후 리다이렉트
            next_url = request.GET.get('next') or '/'
            return redirect(next_url)
        else:
            messages.error(request, '네이버 로그인 인증에 실패했습니다.')
            return redirect('accounts:login')
        
    except Exception as e:
        print(f"전체 에러: {str(e)}")
        
        # 이메일 중복 에러 처리
        if '이미' in str(e) and '가입된 계정' in str(e):
            messages.error(request, str(e))
        else:
            messages.error(request, f'네이버 로그인 처리 중 오류가 발생했습니다.')
        return redirect('accounts:login')

def naver_logout(request):
    """네이버 완전 로그아웃 - 세션 정리 포함"""
    auth_logout(request)
    request.session.flush()
    return redirect('/')

# 구글 로그인
def google_login(request):
    """구글 로그인 페이지로 리다이렉트"""
    service = GoogleAuthService()
    auth_url = service.get_auth_url()
    return redirect(auth_url)

def google_callback(request):
    """🔥 수정: 구글 로그인 콜백 처리 - SocialAccount 모델 사용"""
    print("=== 구글 콜백 디버깅 ===")
    
    code = request.GET.get('code')
    error = request.GET.get('error')
    
    # 에러 확인
    if error:
        print(f"구글 로그인 에러: {error}")
        messages.error(request, '구글 로그인이 취소되었습니다.')
        return redirect('accounts:login')
    
    if not code:
        print("구글 코드 없음")
        messages.error(request, '구글 로그인에 실패했습니다.')
        return redirect('accounts:login')
    
    print(f"구글 코드 받음: {code[:10]}...")
    
    service = GoogleAuthService()
    
    try:
        print("구글 콜백 처리 시작...")
        user = service.handle_callback(code)
        print(f"반환된 사용자: {user.username}")
        print(f"사용자 이메일: {user.email}")
        
        # 🔥 SocialAccount 모델을 통해 소셜 상태 확인
        social_account = user.get_social_account()
        print(f"소셜 계정: {social_account}")
        print(f"가입 완료 여부: {social_account.signup_completed if social_account else 'N/A'}")
        
        # 이메일 기반 인증 (패스워드 없이)
        from django.contrib.auth import authenticate
        print("이메일 기반 인증 시도...")
        authenticated_user = authenticate(
            request, 
            email=user.email, 
            password=None
        )
        print(f"인증 결과: {authenticated_user}")
        
        if authenticated_user:
            print("인증 성공, 로그인 처리...")
            auth_login(request, authenticated_user, backend='accounts.backends.EmailBackend')
            print(f"로그인 성공: {request.user.is_authenticated}")
            
            # 🔥 SocialAccount를 통해 프로필 완성 여부 확인
            social_account = authenticated_user.get_social_account()
            if not social_account or not social_account.signup_completed:
                print("신규 사용자 또는 미완성 프로필 → 프로필 완성 페이지로")
                return redirect('accounts:social_signup_complete')
            else:
                print(f"기존 완성된 사용자 → 메인으로 ({authenticated_user.display_name})")
                messages.success(request, f'환영합니다, {authenticated_user.display_name}님!')
                
            next_url = request.GET.get('next') or '/'
            print(f"리다이렉트 URL: {next_url}")
            return redirect(next_url)
        else:
            print("인증 실패!")
            messages.error(request, '구글 로그인 인증에 실패했습니다.')
            return redirect('accounts:login')
        
    except Exception as e:
        print(f"전체 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # 이메일 중복 에러 처리
        if '이미' in str(e) and '가입된 계정' in str(e):
            messages.error(request, str(e))
        else:
            messages.error(request, f'구글 로그인 처리 중 오류가 발생했습니다: {str(e)}')
        return redirect('accounts:login')

def google_logout(request):
    """구글 로그아웃 + 일반 로그아웃"""
    service = GoogleAuthService()
    
    # 일반 로그아웃 먼저 처리
    auth_logout(request)
    
    # 구글 로그아웃 URL로 리디렉션
    logout_url = service.get_logout_url()
    return redirect(logout_url)

# 스마트 로그아웃 (기존 함수 개선)
def smart_logout(request):
    """🔥 수정: 사용자 타입에 따라 적절한 로그아웃 방식 선택 - SocialAccount 모델 사용"""
    if not request.user.is_authenticated:
        return redirect('/')
    
    # 🔥 SocialAccount 모델을 통해 소셜 로그인 여부 확인
    social_account = request.user.get_social_account()
    if social_account:
        provider = social_account.provider
        if provider == 'kakao':
            return kakao_logout(request)
        elif provider == 'naver':
            return naver_logout(request)
        elif provider == 'google':
            return google_logout(request)
    
    # 소셜 계정이 아니면 일반 로그아웃
    return logout(request)

@login_required
def fandom_verification(request, username):
    """팬덤 인증 페이지 (기존 upload_fandom_card 활용)"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 정보만 확인할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 찜한 아티스트와 그렇지 않은 아티스트 분리
    fandom_profile = user_profile.get_fandom_profile()
    
    if request.user.is_authenticated:
        # 찜한 아티스트 (가나다순 정렬)
        favorite_artists = Artist.objects.filter(followers=request.user).order_by('display_name')
        # 찜하지 않은 아티스트 (가나다순 정렬)
        other_artists = Artist.objects.exclude(followers=request.user).order_by('display_name')
    else:
        favorite_artists = []
        other_artists = Artist.objects.all().order_by('display_name')
    
    context = {
        'user_profile': user_profile,
        'fandom_profile': fandom_profile,
        'favorite_artists': favorite_artists,  # 추가
        'other_artists': other_artists,        # 추가
        'artist_list': Artist.objects.all().order_by('display_name'),  # 기존 호환성 유지
    }
    return render(request, 'accounts/fandom_verification.html', context)


@login_required
def bank_settings(request, username):
    """계좌 설정 페이지 (기존 계좌 함수들 활용)"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 정보만 확인할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 기존 로직 재사용
    bank_profile = user_profile.get_bank_profile()
    
    context = {
        'user_profile': user_profile,
        'bank_profile': bank_profile,
    }
    return render(request, 'accounts/bank_settings.html', context)


@login_required
def address_settings(request, username):
    """주소 설정 페이지 (기존 주소 함수들 활용) - 메시지 업데이트"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 정보만 확인할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 기존 로직 재사용
    address_profile = user_profile.get_address_profile()
    
    context = {
        'user_profile': user_profile,
        'address_profile': address_profile,
    }
    return render(request, 'accounts/address_settings.html', context)

@login_required
def account_info(request, username):
    """계정 정보 페이지"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 정보만 확인할 수 있습니다.')
        return redirect('accounts:mypage')
    
    context = {
        'user_profile': user_profile,
    }
    return render(request, 'accounts/account_info.html', context)


# 공통 신고 
@login_required
@require_POST
def report_post(request, app_name, category, post_id):
    """게시글 신고 처리 (덕담, 덕팜 공통)"""
    # 앱별 모델 가져오기
    if app_name == 'ddokdam':
        from ddokdam.utils import get_post_model
    elif app_name == 'ddokfarm':
        from ddokfarm.utils import get_post_model
    else:
        raise Http404("지원하지 않는 앱입니다.")
    
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")
    
    post = get_object_or_404(model, id=post_id)
    
    # 자신의 게시글은 신고할 수 없음
    if request.user == post.user:
        return JsonResponse({
            'success': False, 
            'error': '자신의 게시글은 신고할 수 없습니다.'
        })
    
    # 이미 신고한 경우 중복 신고 방지
    existing_report = PostReport.objects.filter(
        reporter=request.user,
        content_type=ContentType.objects.get_for_model(post.__class__),
        object_id=post.id
    ).first()
    
    if existing_report:
        return JsonResponse({
            'success': False,
            'error': '이미 신고한 게시글입니다.'
        })
    
    form = PostReportForm(request.POST)
    
    if form.is_valid():
        report = form.save(commit=False)
        report.reporter = request.user
        report.reported_user = post.user
        report.content_type = ContentType.objects.get_for_model(post.__class__)
        report.object_id = post.id
        report.save()
        
        return JsonResponse({
            'success': True,
            'message': '신고가 접수되었습니다. 검토 후 조치하겠습니다.'
        })
    else:
        return JsonResponse({
            'success': False,
            'error': '신고 정보를 확인해주세요.',
            'form_errors': form.errors
        })

@login_required
@require_POST
def report_user(request, user_id):
    """사용자 신고 처리 (채팅방 등에서 사용)"""
    try:
        reported_user = get_object_or_404(User, id=user_id)
        
        # 자신을 신고하는 것 방지
        if request.user == reported_user:
            return JsonResponse({
                'success': False,
                'error': '자신을 신고할 수 없습니다.'
            })
        
        # 신고 데이터 처리
        reason = request.POST.get('reason')
        additional_info = request.POST.get('additional_info', '')
        
        if not reason:
            return JsonResponse({
                'success': False,
                'error': '신고 사유를 선택해주세요.'
            })
        
        # PostReport 모델을 사용해서 사용자 신고 저장
        user_content_type = ContentType.objects.get_for_model(User)
        
        # 중복 신고 확인
        existing_report = PostReport.objects.filter(
            reporter=request.user,
            content_type=user_content_type,
            object_id=reported_user.id
        ).first()
        
        if existing_report:
            return JsonResponse({
                'success': False,
                'error': '이미 신고한 사용자입니다.'
            })
        
        # 신고 생성
        report = PostReport.objects.create(
            reporter=request.user,
            reported_user=reported_user,
            content_type=user_content_type,
            object_id=reported_user.id,
            reason=reason,
            additional_info=additional_info
        )
        
        print(f"✅ 사용자 신고 접수: {request.user.username} → {reported_user.username}")
        
        return JsonResponse({
            'success': True,
            'message': '신고가 접수되었습니다. 검토 후 조치하겠습니다.'
        })
        
    except User.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': '존재하지 않는 사용자입니다.'
        })
    except Exception as e:
        print(f"사용자 신고 처리 오류: {e}")
        return JsonResponse({
            'success': False,
            'error': '신고 처리 중 오류가 발생했습니다.'
        })

@login_required
@require_GET  
def get_report_form(request, app_name, category, post_id):
    """신고 폼 HTML 반환 (덕담, 덕팜 공통)"""
    # 앱별 모델 가져오기
    if app_name == 'ddokdam':
        from ddokdam.utils import get_post_model
    elif app_name == 'ddokfarm':
        from ddokfarm.utils import get_post_model
    else:
        raise Http404("지원하지 않는 앱입니다.")
    
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")
    
    post = get_object_or_404(model, id=post_id)
    
    # 자신의 게시글은 신고할 수 없음
    if request.user == post.user:
        return JsonResponse({
            'success': False,
            'error': '자신의 게시글은 신고할 수 없습니다.'
        })
    
    # 이미 신고한 경우
    existing_report = PostReport.objects.filter(
        reporter=request.user,
        content_type=ContentType.objects.get_for_model(post.__class__),
        object_id=post.id
    ).first()
    
    if existing_report:
        return JsonResponse({
            'success': False,
            'error': '이미 신고한 게시글입니다.'
        })
    
    form = PostReportForm()
    
    # 폼 HTML 렌더링
    form_html = render_to_string('components/_report_form.html', {
        'form': form,
        'post': post,
        'category': category,
        'app_name': app_name,
    }, request=request)
    
    return JsonResponse({
        'success': True,
        'form_html': form_html
    })


@login_required
@require_POST
def submit_banner_request(request):
    """배너 신청 처리"""
    # 🔥 강화된 디버깅
    print("=" * 50)
    print("🔥 배너 신청 요청 받음!")
    print(f"🔥 사용자: {request.user}")
    print(f"🔥 인증됨: {request.user.is_authenticated}")
    print(f"🔥 POST 데이터: {dict(request.POST)}")
    print(f"🔥 FILES 데이터: {dict(request.FILES)}")
    print(f"🔥 Content-Type: {request.content_type}")
    print("=" * 50)
    try:
        print("=== 배너 신청 처리 시작 ===")
        print(f"사용자: {request.user.username}")
        print(f"POST 데이터: {request.POST}")
        print(f"FILES 데이터: {request.FILES}")
        
        # 덕 포인트 확인
        user_ddok_point = request.user.get_or_create_ddok_point()
        required_points = 1000
        
        print(f"사용자 포인트: {user_ddok_point.total_points}")
        print(f"필요 포인트: {required_points}")
        
        if user_ddok_point.total_points < required_points:
            return JsonResponse({
                'success': False,
                'error': f'덕 포인트가 부족합니다. (필요: {required_points}덕, 보유: {user_ddok_point.total_points}덕)'
            })
        
        form = BannerRequestForm(request.POST, request.FILES)
        print(f"폼 유효성: {form.is_valid()}")
        
        if form.is_valid():
            print("폼 유효성 검사 통과")
            
            with transaction.atomic():
                # 배너 신청 생성
                banner_request = form.save(commit=False)
                banner_request.user = request.user
                banner_request.ddok_points_used = required_points
                banner_request.save()
                
                print(f"배너 신청 저장됨: ID {banner_request.id}")
                
                # 덕 포인트 차감
                user_ddok_point.total_points -= required_points
                user_ddok_point.save()
                
                print(f"포인트 차감 완료: {user_ddok_point.total_points}")
                
                # 포인트 사용 로그 생성
                DdokPointLog.objects.create(
                    point_owner=user_ddok_point,
                    points_change=-required_points,  # 마이너스로 기록
                    reason='BANNER_REQUEST',
                    related_member=None
                )
                
                print("포인트 로그 생성 완료")
            
            return JsonResponse({
                'success': True,
                'message': '배너 신청이 완료되었습니다! 관리자 승인 후 3일간 메인 페이지에 표시됩니다.',
                'remaining_points': user_ddok_point.total_points
            })
        else:
            print(f"폼 에러: {form.errors}")
            return JsonResponse({
                'success': False,
                'error': '입력 정보를 확인해주세요.',
                'form_errors': form.errors
            })
            
    except Exception as e:
        print(f"배너 신청 오류: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': '배너 신청 중 오류가 발생했습니다.'
        })

@login_required
def banner_request_form(request):
    """배너 신청 폼을 JSON으로 반환"""
    try:
        form = BannerRequestForm()
        user_ddok_point = request.user.get_or_create_ddok_point()
        required_points = 1000
        
        # 템플릿을 렌더링해서 HTML 문자열로 변환
        from django.template.loader import render_to_string
        
        form_html = render_to_string('accounts/banner_request_form.html', {
            'form': form,
            'user_points': user_ddok_point.total_points,
            'required_points': required_points,
            'can_afford': user_ddok_point.total_points >= required_points,
        }, request=request)
        
        return JsonResponse({
            'success': True,
            'form_html': form_html
        })
        
    except Exception as e:
        print(f"배너 폼 로드 오류: {e}")
        return JsonResponse({
            'success': False,
            'error': '배너 신청 폼을 불러올 수 없습니다.'
        })

