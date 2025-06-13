import json
import os
import time
from itertools import chain
from collections import Counter
from PIL import Image, ExifTags
from dotenv import load_dotenv

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

from ddokfarm.models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment
from ddokdam.models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment
from ddokchat.models import ChatRoom 
from artist.models import Artist, Member
from .models import User, MannerReview, FandomProfile, BankProfile, AddressProfile
from .forms import CustomUserCreationForm, EmailAuthenticationForm, MannerReviewForm, ProfileImageForm, BankAccountForm, AddressForm, SocialSignupCompleteForm
from .services import KakaoAuthService, NaverAuthService

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

            messages.success(request, '인증 이메일이 전송되었습니다!\n이메일을 확인해주세요.')
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
        messages.success(request, '🎉 이메일 인증이 완료되었습니다!\n이제 로그인할 수 있어요.')
        return redirect('accounts:login')
    else:
        messages.error(request, '⚠️ 인증 링크가 유효하지 않거나 만료되었습니다.')
        return redirect('accounts:login')

def login(request):
    if request.method == 'POST':
        form = EmailAuthenticationForm(request.POST)
        if form.is_valid():
            user = form.get_user()

            # ✅ 이메일 인증 여부 체크
            if not user.is_active:
                messages.warning(request, "이메일 인증이 필요합니다.\n이메일을 확인해주세요!")
                # 로그인 실패 처리 (폼에 오류 추가 가능)
                return render(request, 'login.html', {'form': form})

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
    
    # 🔥 새로운 방식: 각 프로필 가져오기
    fandom_profile = user_profile.get_fandom_profile()
    bank_profile = user_profile.get_bank_profile()
    address_profile = user_profile.get_address_profile()
    
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
        'fandom_profile': fandom_profile,      # 🔥 추가
        'bank_profile': bank_profile,          # 🔥 추가 
        'address_profile': address_profile,    # 🔥 추가
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
    }
    return render(request, 'mypage.html', context)

@login_required
def edit_profile(request, username):
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
    return render(request, 'accounts/edit_profile.html', context)

@login_required
def edit_profile_info(request, username):
    user_profile = get_object_or_404(User, username=username)

    if request.method == "POST":
        new_username = request.POST.get("username")
        new_bio = request.POST.get("bio")
        new_first_name = request.POST.get("first_name")  # 닉네임 추가

        # 🔥 닉네임 수정 (first_name 필드에 저장)
        if new_first_name and new_first_name != request.user.first_name:
            # 기본 유효성 검사
            new_first_name = new_first_name.strip()
            
            if len(new_first_name) < 2:
                messages.error(request, "닉네임은 최소 2자 이상이어야 합니다.")
                return redirect('accounts:edit_profile', username=request.user.username)
            
            if len(new_first_name) > 20:
                messages.error(request, "닉네임은 최대 20자까지 입력 가능합니다.")
                return redirect('accounts:edit_profile', username=request.user.username)
            
            # 🔥 소셜 로그인 사용자는 first_name을 닉네임으로 사용
            request.user.first_name = new_first_name
            request.user.save()
            messages.success(request, "닉네임이 수정되었습니다.")
            return redirect('accounts:edit_profile', username=request.user.username)

        # 🔥 일반 사용자용 username 변경 (소셜 로그인 사용자에게는 권장하지 않음)
        if new_username and new_username != request.user.username:
            # 소셜 로그인 사용자는 username 변경 제한
            if request.user.social_signup_completed or request.user.is_temp_username:
                messages.warning(request, "소셜 로그인 사용자는 위의 '닉네임' 필드를 이용해주세요.")
                return redirect('accounts:edit_profile', username=request.user.username)
                
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

    fandom_profile = user_profile.get_fandom_profile()

    context = {
        'user_profile': user_profile,
        'fandom_profile': fandom_profile,
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
        # 🔥 인증 기간 필드 추가
        verification_start_date = request.POST.get('verification_start_date')
        verification_end_date = request.POST.get('verification_end_date')

        if not image:
            messages.error(request, '이미지를 업로드해주세요.')
            return redirect('accounts:edit_profile', username=username)

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
            
            # 🔥 이미지 비율 계산 (누락된 부분 추가)
            width, height = img.size
            uploaded_ratio = width / height if height > 0 else 0
            
            # ✅ 비율 체크
            # expected_ratio = 1278 / 590  # 약 2.17
            # tolerance = 0.2
            # lower_bound = expected_ratio * (1 - tolerance)
            # upper_bound = expected_ratio * (1 + tolerance)

            # if not (lower_bound <= uploaded_ratio <= upper_bound):
            #     messages.error(
            #         request,
            #         f'⚠️ 이미지 비율이 예시와 다릅니다. 세로 기준 약 2.17:1 (±20%) 이내로 맞춰주세요. '
            #         f'→ 현재: {uploaded_ratio:.3f}:1'
            #     )
            #     return redirect('accounts:edit_profile', username=username)

        except Exception as e:
            messages.error(request, f'이미지를 처리할 수 없습니다: {str(e)}')
            return redirect('accounts:edit_profile', username=username)

        # 🔥 FandomProfile에 저장 (인증 기간 포함)
        fandom_profile = user.get_or_create_fandom_profile()
        fandom_profile.fandom_card = image
        fandom_profile.fandom_artist = get_object_or_404(Artist, id=artist_id)
        
        # 🔥 인증 기간 설정
        from datetime import datetime
        if verification_start_date:
            fandom_profile.verification_start_date = datetime.strptime(verification_start_date, '%Y-%m-%d').date()
        if verification_end_date:
            fandom_profile.verification_end_date = datetime.strptime(verification_end_date, '%Y-%m-%d').date()
        
        fandom_profile.is_verified_fandom = False
        fandom_profile.is_pending_verification = True
        fandom_profile.verification_failed = False
        fandom_profile.applied_at = now()
        fandom_profile.save()

        messages.success(request, '🎫 공식 팬덤 인증 확인 중입니다. (3일 소요)')
        return redirect('accounts:edit_profile', username=username)

# 기존 계좌 인증 함수들을 간소화된 버전으로 교체
@login_required
def account_registration(request, username):
    """계좌 정보 등록 (인증 없이 수집만)"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 등록할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 이미 등록된 계좌가 있는지 확인
    bank_profile = user_profile.get_bank_profile()
    if bank_profile:
        messages.info(request, '이미 등록된 계좌가 있습니다.')
        return redirect('accounts:mypage')
    
    if request.method == 'POST':
        print("🔍 POST 요청 받음")
        form = BankAccountForm(request.POST)
        print(f"🔍 폼 데이터: {request.POST}")
        
        if form.is_valid():
            print("🔍 폼 유효성 검사 통과")
            print(f"🔍 cleaned_data: {form.cleaned_data}")
            try:
                bank_profile = form.save(user_profile)
                print(f"🔍 저장 성공: {bank_profile}")
                messages.success(request, '✅ 계좌 정보가 등록되었습니다!')
                return redirect('accounts:mypage')
            except Exception as e:
                print(f"🔍 저장 실패: {str(e)}")
                messages.error(request, f'계좌 등록 중 오류가 발생했습니다: {str(e)}')
        else:
            print(f"🔍 폼 에러: {form.errors}")
    else:
        form = BankAccountForm()
    
    context = {
        'form': form,
        'user_profile': user_profile,
    }
    return render(request, 'accounts/account_registration.html', context)

@login_required  
def account_modify(request, username):
    """등록된 계좌정보 수정"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 수정할 수 있습니다.')
        return redirect('accounts:mypage')
    
    bank_profile = user_profile.get_bank_profile()
    if not bank_profile:
        messages.warning(request, '등록된 계좌가 없습니다. 먼저 계좌를 등록해주세요.')
        return redirect('accounts:account_registration', username=username)
    
    if request.method == 'POST':
        form = BankAccountForm(request.POST)
        if form.is_valid():
            try:
                # 기존 계좌 정보 업데이트
                bank_profile.bank_code = form.cleaned_data['bank_code']
                bank_profile.bank_name = dict(form.BANK_CHOICES)[form.cleaned_data['bank_code']]
                bank_profile.account_number = form.cleaned_data['account_number']
                bank_profile.account_holder = form.cleaned_data['account_holder']
                bank_profile.save()
                
                messages.success(request, '✅ 계좌정보가 수정되었습니다!')
                return redirect('accounts:mypage')
            except Exception as e:
                messages.error(request, f'계좌 수정 중 오류가 발생했습니다: {str(e)}')
    else:
        # 기존 정보로 폼 초기화
        initial_data = {
            'bank_code': bank_profile.bank_code,
            'account_number': bank_profile.account_number,
            'account_holder': bank_profile.account_holder,
        }
        form = BankAccountForm(initial=initial_data)
    
    context = {
        'form': form,
        'user_profile': user_profile,
        'bank_profile': bank_profile,
        'is_modify': True,
    }
    return render(request, 'accounts/account_registration.html', context)

@login_required
def account_delete(request, username):
    """등록된 계좌정보 삭제"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 삭제할 수 있습니다.')
        return redirect('accounts:mypage')
    
    bank_profile = user_profile.get_bank_profile()
    if not bank_profile:
        messages.warning(request, '등록된 계좌가 없습니다.')
        return redirect('accounts:mypage')
    
    if request.method == 'POST':
        bank_profile.delete()
        messages.success(request, '💳 계좌정보가 삭제되었습니다.')
        return redirect('accounts:mypage')
    
    context = {
        'user_profile': user_profile,
        'bank_profile': bank_profile,
    }
    return render(request, 'accounts/account_delete_confirm.html', context)

@login_required
def address_registration(request, username):
    """주소 정보 등록"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 주소만 등록할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 이미 등록된 주소가 있는지 확인
    address_profile = user_profile.get_address_profile()
    if address_profile:
        messages.info(request, '이미 등록된 주소가 있습니다.')
        return redirect('accounts:mypage')
    
    if request.method == 'POST':
        form = AddressForm(request.POST)
        if form.is_valid():
            try:
                address_profile = form.save(user_profile)
                messages.success(request, '✅ 주소 정보가 등록되었습니다!')
                return redirect('accounts:mypage')
            except Exception as e:
                messages.error(request, f'주소 등록 중 오류가 발생했습니다: {str(e)}')
    else:
        form = AddressForm()
    
    context = {
        'form': form,
        'user_profile': user_profile,
    }
    return render(request, 'accounts/address_registration.html', context)

@login_required  
def address_modify(request, username):
    """등록된 주소정보 수정"""
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
                # 기존 주소 정보 업데이트
                address_profile.postal_code = form.cleaned_data['postal_code']
                address_profile.jibun_address = form.cleaned_data['jibun_address']
                address_profile.road_address = form.cleaned_data['road_address']
                address_profile.detail_address = form.cleaned_data['detail_address']
                address_profile.building_name = form.cleaned_data.get('building_name', '')
                address_profile.sido = form.cleaned_data['sido']
                address_profile.sigungu = form.cleaned_data['sigungu']
                address_profile.save()
                
                messages.success(request, '✅ 주소정보가 수정되었습니다!')
                return redirect('accounts:mypage')
            except Exception as e:
                messages.error(request, f'주소 수정 중 오류가 발생했습니다: {str(e)}')
    else:
        # 기존 정보로 폼 초기화
        initial_data = {
            'postal_code': address_profile.postal_code,
            'jibun_address': address_profile.jibun_address,
            'road_address': address_profile.road_address,
            'detail_address': address_profile.detail_address,
            'building_name': address_profile.building_name,
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
        return redirect('accounts:mypage')
    
    if request.method == 'POST':
        address_profile.delete()
        messages.success(request, '🏠 주소정보가 삭제되었습니다.')
        return redirect('accounts:mypage')
    
    context = {
        'user_profile': user_profile,
        'address_profile': address_profile,
    }
    return render(request, 'accounts/address_delete_confirm.html', context)

@login_required
def social_signup_complete(request):
    """소셜 로그인 후 추가 정보 입력 페이지 (필수)"""
    
    print(f"🔍 social_signup_complete 뷰 진입:")
    print(f"   - 사용자: {request.user.username}")
    print(f"   - 소셜 가입 완료: {request.user.social_signup_completed}")
    print(f"   - 임시 사용자명: {request.user.is_temp_username}")
    
    # 이미 프로필을 완성한 사용자는 메인 페이지로 리다이렉트
    if request.user.social_signup_completed:
        print("✅ 이미 프로필 완성된 사용자 → 메인으로")
        return redirect('/')
    
    # 소셜 로그인 사용자가 아니면 메인 페이지로 리다이렉트
    if not request.user.is_temp_username:
        print("❌ 소셜 로그인 사용자가 아님 → 메인으로")
        return redirect('/')
    
    if request.method == 'POST':
        print("📝 POST 요청 - 폼 처리 시작")
        form = SocialSignupCompleteForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            print("✅ 폼 유효성 검사 통과")
            try:
                user = form.save()
                print(f"✅ 폼 저장 완료:")
                print(f"   - 최종 username: {user.username}")
                print(f"   - social_signup_completed: {user.social_signup_completed}")
                print(f"   - is_temp_username: {user.is_temp_username}")
                
                # 🔥 저장 후 다시 확인
                user.refresh_from_db()
                print(f"🔄 DB에서 다시 조회한 결과:")
                print(f"   - username: {user.username}")
                print(f"   - social_signup_completed: {user.social_signup_completed}")
                print(f"   - is_temp_username: {user.is_temp_username}")
                
                messages.success(request, f'🎉 환영합니다, {user.username}님! 어덕해를 시작해보세요!')
                return redirect('/')
            except Exception as e:
                print(f"❌ 폼 저장 중 오류: {e}")
                import traceback
                traceback.print_exc()
                messages.error(request, '프로필 저장 중 오류가 발생했습니다.')
        else:
            # 폼 에러가 있으면 에러 메시지 표시
            print(f"❌ 폼 유효성 검사 실패: {form.errors}")
            messages.error(request, '입력 정보를 다시 확인해주세요.')
    else:
        print("📄 GET 요청 - 폼 표시")
        form = SocialSignupCompleteForm(instance=request.user)
    
    return render(request, 'accounts/social_signup_complete.html', {
        'form': form
    })

# @login_required
# def social_complete_skip(request):
#     """소셜 가입 프로필 설정 건너뛰기"""
#     if request.method == 'POST':
#         user = request.user
        
#         # 🔥 기본 username 설정 (임시에서 실제로 변경)
#         if user.is_temp_username:
#             # 고유한 기본 username 생성
#             base_username = None
#             if user.username.startswith('temp_kakao_'):
#                 base_username = '카카오사용자'
#             elif user.username.startswith('temp_naver_'):
#                 base_username = '네이버사용자'
#             else:
#                 base_username = '새로운사용자'
            
#             # 중복되지 않는 username 생성
#             final_username = base_username
#             counter = 1
#             while User.objects.filter(username=final_username).exclude(id=user.id).exists():
#                 final_username = f'{base_username}{counter}'
#                 counter += 1
            
#             user.username = final_username
#             user.is_temp_username = False
        
#         user.social_signup_completed = True
#         user.save()
        
#         return JsonResponse({'success': True})
    
#     return JsonResponse({'success': False})

# ======================
# 카카오 로그인
# ======================
def kakao_login(request):
    """카카오 로그인 페이지로 리다이렉트"""
    service = KakaoAuthService()
    auth_url = service.get_auth_url()
    return redirect(auth_url)

def kakao_callback(request):
    """카카오 로그인 콜백 처리"""
    print("=== 카카오 콜백 디버깅 ===")
    
    code = request.GET.get('code')
    if not code:
        messages.error(request, '카카오 로그인에 실패했습니다.')
        return redirect('accounts:login')
    
    service = KakaoAuthService()
    
    try:
        user = service.handle_callback(code)
        print(f"🔍 반환된 사용자: {user.username}")
        print(f"🔍 사용자 이메일: {user.email}")
        print(f"🔍 임시 사용자명 여부: {user.is_temp_username}")
        print(f"🔍 소셜 가입 완료 여부: {user.social_signup_completed}")
        
        # 이메일 기반 인증 (패스워드 없이)
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(
            request, 
            email=user.email, 
            password=None
        )
        print(f"🔍 인증 결과: {authenticated_user}")
        
        if authenticated_user:
            auth_login(request, authenticated_user, backend='accounts.backends.EmailBackend')
            print(f"🔍 로그인 성공: {request.user.is_authenticated}")
            
            # 🔥 프로필 완성 여부에 따라 분기 처리
            if not authenticated_user.social_signup_completed:
                print("🔍 신규 사용자 또는 미완성 프로필 → 프로필 완성 페이지로")
                return redirect('accounts:social_signup_complete')
            else:
                print(f"🔍 기존 완성된 사용자 → 메인으로 ({authenticated_user.display_name})")
                messages.success(request, f'환영합니다, {authenticated_user.display_name}님! 🎉')
                
            next_url = request.GET.get('next') or '/'
            return redirect(next_url)
        else:
            print("❌ 인증 실패!")
            messages.error(request, '카카오 로그인 인증에 실패했습니다.')
            return redirect('accounts:login')
        
    except Exception as e:
        print(f"❌ 전체 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # 🔥 이메일 중복 에러 처리
        if '이미' in str(e) and '가입된 계정' in str(e):
            messages.error(request, str(e))
        else:
            messages.error(request, f'카카오 로그인 처리 중 오류가 발생했습니다.')
        return redirect('accounts:login')

def kakao_logout(request):
    """카카오 로그아웃 + 일반 로그아웃"""
    service = KakaoAuthService()
    
    # 일반 로그아웃 먼저 처리
    auth_logout(request)
    
    # 카카오 로그아웃 URL로 리다이렉트
    logout_url = service.get_logout_url()
    return redirect(logout_url)

# ======================
# 네이버 로그인
# ======================
def naver_login(request):
    """네이버 로그인 페이지로 리다이렉트"""
    service = NaverAuthService()
    auth_url, state = service.get_auth_url()
    
    # 세션에 state 저장 (보안을 위해)
    request.session['naver_state'] = state
    
    return redirect(auth_url)

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
    service = NaverAuthService()
    session_state = request.session.get('naver_state')
    
    if not service.validate_state(state, session_state):
        messages.error(request, '보안 검증에 실패했습니다.')
        return redirect('accounts:login')
    
    try:
        user = service.handle_callback(code, state)
        print(f"🔍 반환된 사용자: {user.username}")
        print(f"🔍 사용자 이메일: {user.email}")
        print(f"🔍 임시 사용자명 여부: {user.is_temp_username}")
        print(f"🔍 소셜 가입 완료 여부: {user.social_signup_completed}")
        
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
            
            # 🔥 프로필 완성 여부에 따라 분기 처리
            if not authenticated_user.social_signup_completed:
                print("🔍 신규 사용자 또는 미완성 프로필 → 프로필 완성 페이지로")
                return redirect('accounts:social_signup_complete')
            else:
                print(f"🔍 기존 완성된 사용자 → 메인으로 ({authenticated_user.display_name})")
                messages.success(request, f'환영합니다, {authenticated_user.display_name}님! 🎉')
            
            # 기존 사용자면 next 파라미터 확인 후 리다이렉트
            next_url = request.GET.get('next') or '/'
            return redirect(next_url)
        else:
            messages.error(request, '네이버 로그인 인증에 실패했습니다.')
            return redirect('accounts:login')
        
    except Exception as e:
        print(f"❌ 전체 에러: {str(e)}")
        
        # 🔥 이메일 중복 에러 처리
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

# ======================
# 스마트 로그아웃 (기존 함수 개선)
# ======================
def smart_logout(request):
    """사용자 타입에 따라 적절한 로그아웃 방식 선택"""
    if not request.user.is_authenticated:
        return redirect('/')
    
    username = request.user.username
    
    if username.startswith('kakao_'):
        return kakao_logout(request)
    elif username.startswith('naver_'):
        return naver_logout(request)
    else:
        return logout(request)  # 기존 logout 함수 호출


@login_required
def fandom_verification(request, username):
    """팬덤 인증 페이지 (기존 upload_fandom_card 활용)"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 정보만 확인할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 기존 로직 재사용
    fandom_profile = user_profile.get_fandom_profile()
    artist_list = Artist.objects.all().order_by('display_name')
    
    context = {
        'user_profile': user_profile,
        'fandom_profile': fandom_profile,
        'artist_list': artist_list,
    }
    return render(request, 'accounts/fandom_verification.html', context)


@login_required
def account_settings(request, username):
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
    return render(request, 'accounts/account_settings.html', context)


@login_required
def address_settings(request, username):
    """주소 설정 페이지 (기존 주소 함수들 활용)"""
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