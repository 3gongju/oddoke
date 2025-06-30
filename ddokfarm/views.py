from django.template.loader import render_to_string
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponseForbidden, HttpResponseNotAllowed
from django.views.decorators.http import require_POST, require_GET
from django.http import JsonResponse, HttpResponse
from django.urls import reverse
from django.db.models import Q, F, Min
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from django.forms import modelformset_factory
from django.utils import timezone
from django.db import transaction
from django import forms
from operator import attrgetter
from itertools import chain
from artist.models import Member, Artist
from .models import (
    FarmComment, 
    FarmSellPost, 
    FarmRentalPost, 
    FarmSplitPost, 
    FarmPostImage,
    SplitPrice,
    SplitApplication,
    ItemPrice,
    ExchangeItem,
)
from .forms import FarmCommentForm, SplitPriceForm, ItemPriceForm
from .utils import (
    get_post_model,
    get_post_form,
    get_post_comments,
    get_post_queryset,
    get_ajax_base_context,
    get_ddokfarm_categories,
    get_ddokfarm_category_urls,
)
from ddokchat.models import ChatRoom

# 홈 화면 (루트 URL)
def main(request):
    return render(request, 'main/home.html')

# 전체 게시글 보기
def index(request):
    category = request.GET.get('category')
    wantto = request.GET.get('wantto')
    query = request.GET.get('q', '').strip()
    sort_by = request.GET.get('sort', 'latest')
    show_available_only = request.GET.get('available_only') == 'on'
    
    # 찜한 아티스트 필터링
    favorites_only = request.GET.get('favorites_only') == 'on'
    
    # 기존 필터링 파라미터들
    selected_shipping = request.GET.get('shipping', '')
    selected_conditions = request.GET.getlist('condition')
    selected_md = request.GET.getlist('md')
    min_price = request.GET.get('min_price', '')
    max_price = request.GET.get('max_price', '')

    # 찜한 아티스트 ID 목록 미리 가져오기 (성능 최적화)
    favorite_artist_ids = []
    if favorites_only and request.user.is_authenticated:
        favorite_artist_ids = list(request.user.favorite_artists.values_list('id', flat=True))
        if not favorite_artist_ids:
            # 찜한 아티스트가 없으면 빈 결과 반환
            posts = []
            # 컨텍스트는 그대로 유지...
            context = {
                'posts': posts,
                'category': category,
                'wantto': wantto,
                'query': query,
                'sort_by': sort_by,
                'show_available_only': show_available_only,
                'favorites_only': favorites_only,
                'favorite_artists': [],
                'search_action': reverse('ddokfarm:index'),
                'create_url': f"{reverse('ddokfarm:post_create')}?category={category or 'sell'}",
                'category_urls': get_ddokfarm_category_urls(),
                'default_category': 'sell',
                'selected_shipping': selected_shipping,
                'selected_conditions': selected_conditions,
                'selected_md': selected_md,
                'min_price': min_price,
                'max_price': max_price,
                'selected_shipping_display': '',
                'condition_display_map': {},
                'md_display_map': {},
            }
            return render(request, 'ddokfarm/index.html', context)

    # 기본 필터링 조건 구성
    def get_base_filter_conditions():
        filter_conditions = Q()
        
        # 찜한 아티스트 필터
        if favorites_only and favorite_artist_ids:
            filter_conditions &= Q(artist_id__in=favorite_artist_ids)
        
        if selected_shipping:
            filter_conditions &= Q(shipping=selected_shipping)
        
        if selected_conditions:
            condition_q = Q()
            for condition in selected_conditions:
                condition_q |= Q(condition=condition)
            filter_conditions &= condition_q
        
        if wantto:
            filter_conditions &= Q(want_to=wantto)
            
        return filter_conditions

    # MD 필터링 (판매만)
    def get_md_filter():
        if selected_md:
            md_q = Q()
            for md in selected_md:
                md_q |= Q(md=md)
            return md_q
        return Q()

    # 가격 필터링 헬퍼
    def get_price_filtered_ids(model_class):
        ids = []
        if min_price or max_price:
            for post in model_class.objects.all():
                item_prices = post.get_item_prices().filter(is_price_undetermined=False)
                if item_prices.exists():
                    prices = list(item_prices.values_list('price', flat=True))
                    min_post_price = min(prices)
                    max_post_price = max(prices)
                    
                    valid = True
                    if min_price:
                        try:
                            if min_post_price < float(min_price):
                                valid = False
                        except ValueError:
                            pass
                    if max_price and valid:
                        try:
                            if max_post_price > float(max_price):
                                valid = False
                        except ValueError:
                            pass
                    
                    if valid:
                        ids.append(post.id)
        return ids

    # 검색 로직 개선
    if query:
        base_filter = get_base_filter_conditions()
        md_filter = get_md_filter()
        
        # 공통 검색 조건
        artist_filter = (
            Q(artist__display_name__icontains=query) |
            Q(artist__korean_name__icontains=query) |
            Q(artist__english_name__icontains=query) |
            Q(artist__alias__icontains=query)
        )
        member_filter = Q(members__member_name__icontains=query)
        text_filter = Q(title__icontains=query) | Q(content__icontains=query)
        search_filter = text_filter | artist_filter | member_filter

        # 각 모델별로 별도 쿼리 (성능 최적화)
        all_posts = []

        # 판매 게시글
        sell_price_ids = get_price_filtered_ids(FarmSellPost) if (min_price or max_price) else None
        sell_conditions = base_filter & search_filter & md_filter
        if sell_price_ids is not None:
            sell_conditions &= Q(id__in=sell_price_ids)
        
        sell_posts = FarmSellPost.objects.filter(sell_conditions).select_related(
            'user', 'artist', 'user__fandom_profile'
        ).prefetch_related('like', 'images').distinct()
        for post in sell_posts:
            post.category = 'sell'
        all_posts.extend(sell_posts)

        # 대여 게시글
        rental_price_ids = get_price_filtered_ids(FarmRentalPost) if (min_price or max_price) else None
        rental_conditions = base_filter & search_filter
        if rental_price_ids is not None:
            rental_conditions &= Q(id__in=rental_price_ids)
            
        rental_posts = FarmRentalPost.objects.filter(rental_conditions).select_related(
            'user', 'artist', 'user__fandom_profile'
        ).prefetch_related('like', 'images').distinct()
        for post in rental_posts:
            post.category = 'rental'
        all_posts.extend(rental_posts)

        # 분철 게시글 (별도 처리)
        split_conditions = text_filter | artist_filter | Q(member_prices__member__member_name__icontains=query)
        if favorites_only and favorite_artist_ids:
            split_conditions &= Q(artist_id__in=favorite_artist_ids)
        
        # 분철 가격 필터
        if min_price:
            try:
                split_conditions &= Q(member_prices__price__gte=float(min_price))
            except ValueError:
                pass
        if max_price:
            try:
                split_conditions &= Q(member_prices__price__lte=float(max_price))
            except ValueError:
                pass
                
        split_posts = FarmSplitPost.objects.filter(split_conditions).select_related(
            'user', 'artist', 'user__fandom_profile'
        ).prefetch_related('like', 'member_prices', 'images').distinct()
        for post in split_posts:
            post.category = 'split'
        all_posts.extend(split_posts)

        posts = all_posts

    else:
        # 카테고리별 필터링 개선
        base_filter = get_base_filter_conditions()
        
        if category == 'sell':
            md_filter = get_md_filter()
            price_ids = get_price_filtered_ids(FarmSellPost) if (min_price or max_price) else None
            
            conditions = base_filter & md_filter
            if price_ids is not None:
                conditions &= Q(id__in=price_ids)
                
            posts = FarmSellPost.objects.filter(conditions).select_related(
                'user', 'artist', 'user__fandom_profile'
            ).prefetch_related('like', 'images')
            for post in posts:
                post.category = 'sell'
                
        elif category == 'rental':
            price_ids = get_price_filtered_ids(FarmRentalPost) if (min_price or max_price) else None
            
            conditions = base_filter
            if price_ids is not None:
                conditions &= Q(id__in=price_ids)
                
            posts = FarmRentalPost.objects.filter(conditions).select_related(
                'user', 'artist', 'user__fandom_profile'
            ).prefetch_related('like', 'images')
            for post in posts:
                post.category = 'rental'
                
        elif category == 'split':
            conditions = Q()
            if favorites_only and favorite_artist_ids:
                conditions &= Q(artist_id__in=favorite_artist_ids)
            
            if min_price:
                try:
                    conditions &= Q(member_prices__price__gte=float(min_price))
                except ValueError:
                    pass
            if max_price:
                try:
                    conditions &= Q(member_prices__price__lte=float(max_price))
                except ValueError:
                    pass
                    
            posts = FarmSplitPost.objects.filter(conditions).select_related(
                'user', 'artist', 'user__fandom_profile'
            ).prefetch_related('like', 'member_prices', 'images').distinct()
            for post in posts:
                post.category = 'split'
                
        else:
            # 전체 카테고리 - 각각 별도 쿼리 후 합치기
            all_posts = []
            
            # 판매
            md_filter = get_md_filter()
            sell_price_ids = get_price_filtered_ids(FarmSellPost) if (min_price or max_price) else None
            sell_conditions = base_filter & md_filter
            if sell_price_ids is not None:
                sell_conditions &= Q(id__in=sell_price_ids)
                
            sell_posts = FarmSellPost.objects.filter(sell_conditions).select_related(
                'user', 'artist', 'user__fandom_profile'
            ).prefetch_related('like', 'images')
            for post in sell_posts:
                post.category = 'sell'
            all_posts.extend(sell_posts)
            
            # 대여
            rental_price_ids = get_price_filtered_ids(FarmRentalPost) if (min_price or max_price) else None
            rental_conditions = base_filter
            if rental_price_ids is not None:
                rental_conditions &= Q(id__in=rental_price_ids)
                
            rental_posts = FarmRentalPost.objects.filter(rental_conditions).select_related(
                'user', 'artist', 'user__fandom_profile'
            ).prefetch_related('like', 'images')
            for post in rental_posts:
                post.category = 'rental'
            all_posts.extend(rental_posts)
            
            # 분철
            split_conditions = Q()
            if favorites_only and favorite_artist_ids:
                split_conditions &= Q(artist_id__in=favorite_artist_ids)
            
            if min_price:
                try:
                    split_conditions &= Q(member_prices__price__gte=float(min_price))
                except ValueError:
                    pass
            if max_price:
                try:
                    split_conditions &= Q(member_prices__price__lte=float(max_price))
                except ValueError:
                    pass
                    
            split_posts = FarmSplitPost.objects.filter(split_conditions).select_related(
                'user', 'artist', 'user__fandom_profile'
            ).prefetch_related('like', 'member_prices', 'images').distinct()
            for post in split_posts:
                post.category = 'split'
            all_posts.extend(split_posts)
            
            posts = all_posts

        if not isinstance(posts, list):
            posts = list(posts)

    # 판매중 필터 적용
    if show_available_only:
        posts = [post for post in posts if not post.is_sold]

    # 정렬
    if sort_by == 'latest':
        posts = sorted(posts, key=attrgetter('created_at'), reverse=True)
    elif sort_by == 'price_low':
        posts = sorted(posts, key=lambda x: getattr(x, 'effective_price', float('inf')))
    elif sort_by == 'price_high':
        posts = sorted(posts, key=lambda x: getattr(x, 'effective_price', 0), reverse=True)
    elif sort_by == 'likes':
        posts = sorted(posts, key=lambda x: x.like.count(), reverse=True)
    else:
        posts = sorted(posts, key=attrgetter('created_at'), reverse=True)

    # detail_url 설정
    for post in posts:
        post.detail_url = reverse('ddokfarm:post_detail', args=[post.category, post.id])

        # 댓글 개수 계산 추가
        content_type = ContentType.objects.get_for_model(post.__class__)
        post.total_comment_count = FarmComment.objects.filter(
            content_type=content_type, 
            object_id=post.id
        ).count()

    clean_category = (category or 'sell').split('?')[0]

    # 찜한 아티스트 목록
    favorite_artists = []
    if request.user.is_authenticated:
        favorite_artists = list(request.user.favorite_artists.all())
    
    # 필터 표시용 데이터 생성
    shipping_choices = dict(FarmSellPost.SHIPPING_CHOICES)
    condition_choices = dict(FarmSellPost.CONDITION_CHOICES)
    md_choices = dict(FarmSellPost.MD_CHOICES)
    
    condition_display_map = {}
    for condition in selected_conditions:
        condition_display_map[condition] = condition_choices.get(condition, condition)
    
    md_display_map = {}
    for md in selected_md:
        md_display_map[md] = md_choices.get(md, md)
    
    context = {
        'posts': posts,
        'category': category,
        'wantto': wantto,
        'query': query,
        'sort_by': sort_by,
        'show_available_only': show_available_only,
        'favorites_only': favorites_only,
        'favorite_artists': favorite_artists,
        'search_action': reverse('ddokfarm:index'),
        'create_url': f"{reverse('ddokfarm:post_create')}?category={clean_category}",
        'category_urls': get_ddokfarm_category_urls(),
        'default_category': 'sell',
        'selected_shipping': selected_shipping,
        'selected_conditions': selected_conditions,
        'selected_md': selected_md,
        'min_price': min_price,
        'max_price': max_price,
        'selected_shipping_display': shipping_choices.get(selected_shipping, ''),
        'condition_display_map': condition_display_map,
        'md_display_map': md_display_map,
    }

    return render(request, 'ddokfarm/index.html', context)

# 가격 필터링을 위한 헬퍼 함수들
def get_posts_with_min_price(min_price):
    """최소 가격 이상인 게시글 ID 목록 반환 (가격 미정 제외)"""
    sell_ids = []
    rental_ids = []
    
    # 판매 게시글
    for post in FarmSellPost.objects.all():
        item_prices = post.get_item_prices().filter(is_price_undetermined=False)
        if item_prices.exists():
            min_post_price = min(item_prices.values_list('price', flat=True))
            if min_post_price >= min_price:
                sell_ids.append(post.id)
    
    # 대여 게시글
    for post in FarmRentalPost.objects.all():
        item_prices = post.get_item_prices().filter(is_price_undetermined=False)
        if item_prices.exists():
            min_post_price = min(item_prices.values_list('price', flat=True))
            if min_post_price >= min_price:
                rental_ids.append(post.id)
    
    return sell_ids + rental_ids

def get_posts_with_max_price(max_price):
    """최대 가격 이하인 게시글 ID 목록 반환 (가격 미정 제외)"""
    sell_ids = []
    rental_ids = []
    
    # 판매 게시글
    for post in FarmSellPost.objects.all():
        item_prices = post.get_item_prices().filter(is_price_undetermined=False)
        if item_prices.exists():
            max_post_price = max(item_prices.values_list('price', flat=True))
            if max_post_price <= max_price:
                sell_ids.append(post.id)
    
    # 대여 게시글
    for post in FarmRentalPost.objects.all():
        item_prices = post.get_item_prices().filter(is_price_undetermined=False)
        if item_prices.exists():
            max_post_price = max(item_prices.values_list('price', flat=True))
            if max_post_price <= max_price:
                rental_ids.append(post.id)
    
    return sell_ids + rental_ids

# 판매 게시글 보기
def sell_index(request):
    return redirect('/ddokfarm/?category=sell')

# 대여 게시글 보기
def rental_index(request):
    return redirect('/ddokfarm/?category=rental')

# 분철 게시글 보기
def split_index(request):
    return redirect('/ddokfarm/?category=split')

# 게시글 상세보기
def post_detail(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    # ✅ 조회수 증가 로직 (접근할 때마다 무조건 증가)
    model.objects.filter(id=post_id).update(view_count=F('view_count') + 1)
    # post 객체 새로고침하여 최신 view_count 반영
    post.refresh_from_db(fields=['view_count'])

    comment_qs = get_post_comments(post)
    comments = comment_qs.filter(parent__isnull=True).select_related('user').prefetch_related('replies__user')
    total_comment_count = comment_qs.count()
    comment_form = FarmCommentForm()
    is_liked = request.user.is_authenticated and post.like.filter(id=request.user.id).exists()
    comment_create_url = reverse('ddokfarm:comment_create', kwargs={'category': category, 'post_id': post_id})
    is_owner = request.user == post.user

    context = {
        'post': post,
        'category': category,
        'comments': comments,
        'total_comment_count': total_comment_count,
        'comment_form': comment_form,
        'is_liked': is_liked,
        'artist': post.artist,
        'app_name': 'ddokfarm',
        'comment_create_url': comment_create_url,
        'comment_delete_url_name': 'ddokfarm:comment_delete',
        'is_owner': is_owner,
    }

    # ✅ 개별 가격 정보 추가 (판매/대여)
    if category in ['sell', 'rental']:
        item_prices = post.get_item_prices().order_by('id')
        
        # 🔧 디버깅을 위한 로그 추가
        print(f"=== POST DETAIL DEBUG ===")
        print(f"Post ID: {post.id}, Category: {category}")
        print(f"Item prices count: {item_prices.count()}")
        for item in item_prices:
            print(f"Item: {item.get_display_name()} - Price: {item.price} - Undetermined: {item.is_price_undetermined}")
        
        context['item_prices'] = item_prices
        context['has_individual_prices'] = item_prices.count() > 1  # 2개 이상일 때만 개별 가격으로 간주
        
        # 🔧 단일 아이템인 경우 첫 번째 아이템의 정보 추가
        if item_prices.count() == 1:
            first_item = item_prices.first()
            context['single_item_price'] = first_item
            print(f"Single item: {first_item.get_display_name()} - {first_item.price}")
        elif item_prices.count() == 0:
            print("⚠️ No item prices found!")
            
        print(f"has_individual_prices: {context['has_individual_prices']}")

    # 분철 처리 (기존과 동일)
    if category == 'split':
        # 승인된 신청에서 멤버들을 가져와서 checked_out_members에 추가
        approved_applications = SplitApplication.objects.filter(
            post=post, 
            status='approved'
        ).prefetch_related('members')
        
        # 승인된 모든 멤버들을 checked_out_members에 추가
        approved_member_ids = set()
        for app in approved_applications:
            for member in app.members.all():
                approved_member_ids.add(member.id)
        
        # 기존 checked_out_members와 승인된 멤버들을 합침
        manual_checked_out = post.checked_out_members.all()
        all_checked_out_ids = set(manual_checked_out.values_list('id', flat=True)) | approved_member_ids
        
        # 전체 멤버 가격 정보
        all_member_prices = post.member_prices.select_related('member').all()
        
        # 잔여 멤버 (가격이 있지만 마감되지 않은 멤버들)
        participating_member_prices = all_member_prices.exclude(member_id__in=all_checked_out_ids)
        participating_members = [sp.member for sp in participating_member_prices]
        
        # 마감된 멤버들 (수동 마감 + 승인된 신청)
        checked_out_members = Member.objects.filter(id__in=all_checked_out_ids).distinct()

        # 가격 범위 계산 (잔여 멤버들만)
        prices = [sp.price for sp in participating_member_prices if sp.price]
        if prices:
            min_price = min(prices)
            max_price = max(prices)
        else:
            min_price = max_price = 0

        context.update({
            'member_prices': participating_member_prices,  # 잔여 멤버의 가격만
            'min_price': min_price,
            'max_price': max_price,
            'participating_members': participating_members,  # 잔여 멤버들
            'checked_out_members': checked_out_members,  # 마감된 멤버들
        })
    else:
        context['members'] = post.members.all()

    return render(request, 'ddokfarm/detail.html', context)

# 교환 정보 저장 헬퍼 함수
def save_exchange_info(request, post):
    """교환 정보 저장 - want_to가 'exchange'일 때만"""
    if request.POST.get('want_to') == 'exchange':
        give_description = request.POST.get('give_description', '').strip()
        want_description = request.POST.get('want_description', '').strip()
        
        if give_description and want_description:
            # 기존 교환 정보가 있으면 업데이트, 없으면 생성
            exchange_info, created = ExchangeItem.objects.get_or_create(
                post=post,
                defaults={
                    'give_description': give_description,
                    'want_description': want_description,
                }
            )
            
            if not created:
                # 기존 정보 업데이트
                exchange_info.give_description = give_description
                exchange_info.want_description = want_description
                exchange_info.save()
                
            return exchange_info
    else:
        # want_to가 'exchange'가 아니면 기존 교환 정보 삭제
        if hasattr(post, 'exchange_info'):
            post.exchange_info.delete()
        return None

def get_item_price_formset(post=None, data=None):
    """ItemPrice FormSet 생성 헬퍼 - 수정된 버전"""
    
    # 🔧 FormSet 클래스 정의
    ItemPriceFormSet = modelformset_factory(
        ItemPrice,
        form=ItemPriceForm,
        extra=0,
        can_delete=True,
        min_num=0,  # 최소 개수 0
        validate_min=False,  # 최소 검증 비활성화
        max_num=20,
    )
    
    if post:
        # 수정 모드: 기존 ItemPrice 쿼리셋
        content_type = ContentType.objects.get_for_model(post.__class__)
        queryset = ItemPrice.objects.filter(
            content_type=content_type, 
            object_id=post.id
        ).order_by('id')
    else:
        # 생성 모드: 빈 쿼리셋
        queryset = ItemPrice.objects.none()
    
    if data:
        return ItemPriceFormSet(data, queryset=queryset, prefix='item_prices')
    else:
        return ItemPriceFormSet(queryset=queryset, prefix='item_prices')

def save_item_prices_from_formset(formset, post):
    """ModelFormSet을 사용한 ItemPrice 저장 (디버깅 강화 버전)"""
    print(f"=== save_item_prices_from_formset DEBUG ===")
    print(f"Post ID: {post.id}")
    print(f"Post type: {type(post)}")
    print(f"Formset is_valid: {formset.is_valid()}")
    print(f"Formset errors: {formset.errors}")

    if post.id is None:
        print("❌ ERROR: Post ID is None")
        raise ValueError("Post must be saved before saving item prices")

    content_type = ContentType.objects.get_for_model(post.__class__)
    print(f"Content type: {content_type}")

    # 🔧 FormSet 데이터 확인
    print(f"=== FORMSET DATA ANALYSIS ===")
    for i, form in enumerate(formset.forms):
        print(f"Form {i}:")
        print(f"  - has_changed: {form.has_changed()}")
        print(f"  - is_valid: {form.is_valid()}")
        if hasattr(form, 'cleaned_data'):
            print(f"  - cleaned_data: {form.cleaned_data}")
        print(f"  - errors: {form.errors}")
        if hasattr(form, 'instance') and form.instance.pk:
            print(f"  - instance ID: {form.instance.pk}")

    # 🔧 기존 데이터 확인
    existing_items = ItemPrice.objects.filter(content_type=content_type, object_id=post.id)
    print(f"Existing items before save: {existing_items.count()}")
    for item in existing_items:
        print(f"  - Existing: {item.id} - {item.item_name} - {item.price}")

    try:
        # FormSet save 실행
        instances = formset.save(commit=False)
        print(f"FormSet.save() returned {len(instances)} instances")
        
        # 각 인스턴스에 post 정보 설정
        for instance in instances:
            instance.content_type = content_type
            instance.object_id = post.id
            print(f"Saving instance: ID={instance.pk}, name='{instance.item_name}', price={instance.price}, undetermined={instance.is_price_undetermined}")
            instance.save()
        
        # 삭제 표시된 객체들 처리
        for obj in formset.deleted_objects:
            print(f"Deleting instance: {obj.id}")
            obj.delete()
        
        # 🔧 저장 후 확인
        final_items = ItemPrice.objects.filter(content_type=content_type, object_id=post.id)
        print(f"Final items after save: {final_items.count()}")
        for item in final_items:
            print(f"  - Final: {item.id} - {item.item_name} - {item.price}")
        
        print(f"✅ Successfully saved {len(instances)} items and deleted {len(formset.deleted_objects)} items")
        return len(instances)
        
    except Exception as e:
        print(f"❌ Error in save_item_prices_from_formset: {e}")
        import traceback
        traceback.print_exc()
        raise

@login_required
def post_create(request):
    favorite_artists = Artist.objects.filter(followers=request.user)
    raw_category = request.POST.get('category') or request.GET.get('category') or 'sell'
    category = raw_category.split('?')[0]
    form_class = get_post_form(category)

    if not form_class:
        raise Http404("존재하지 않는 카테고리입니다.")

    default_artist_id = int(request.GET.get('artist')) if request.GET.get('artist') else (
        favorite_artists[0].id if favorite_artists.exists() else None
    )

    selected_artist_id = default_artist_id
    selected_member_ids = []

    if request.method == 'POST':
        selected_member_ids = list(set(map(int, request.POST.getlist('members'))))
        selected_artist_id = request.POST.get('artist') or request.GET.get('artist') or default_artist_id
        image_files = request.FILES.getlist('images')

        # 기본 폼
        form = form_class(request.POST, request.FILES)

        # 가격 입력 모드 구분
        price_mode = request.POST.get('price_mode')
        is_single_mode = price_mode == 'single'
        single_price_data = None

        # 판매/대여일 경우 ItemPrice 처리
        item_price_formset = None
        if category in ['sell', 'rental']:
            if is_single_mode:
                price = request.POST.get('single_price', '').strip()
                undetermined = request.POST.get('single_price_undetermined') == 'on'
                single_price_data = {
                    'price': price,
                    'undetermined': undetermined
                }
                item_price_formset = get_item_price_formset(data=None)  # 빈 formset
            else:
                item_price_formset = get_item_price_formset(data=request.POST)

        # 분철일 경우 SplitPriceFormSet 생성
        if category == 'split' and selected_artist_id:
            selected_members = Member.objects.filter(artist_name__id=selected_artist_id).distinct()
            initial_data = [{'member': m.id} for m in selected_members]
            SplitPriceFormSet = modelformset_factory(SplitPrice, form=SplitPriceForm, extra=len(initial_data), can_delete=False)
            formset = SplitPriceFormSet(request.POST, prefix='splitprice', initial=initial_data, queryset=SplitPrice.objects.none())
        else:
            formset = None

        # 유효성 검사
        form_valid = form.is_valid()
        item_price_formset_valid = item_price_formset.is_valid() if item_price_formset and not is_single_mode else True
        split_formset_valid = formset.is_valid() if formset else True

        # 단일 가격 모드 별도 검증
        if is_single_mode and category in ['sell', 'rental']:
            if not single_price_data['price'] and not single_price_data['undetermined']:
                form.add_error(None, "가격을 입력하거나 '가격 미정'을 선택해주세요.")
                item_price_formset_valid = False

        if form_valid and item_price_formset_valid and split_formset_valid:
            if not image_files:
                form.add_error(None, "이미지는 최소 1장 이상 업로드해야 합니다.")
            else:
                post = form.save(commit=False)
                post.user = request.user
                if selected_artist_id:
                    post.artist_id = selected_artist_id
                post.save()

                # 단일 가격 저장
                if is_single_mode and single_price_data:
                    ItemPrice.objects.create(
                        content_type=ContentType.objects.get_for_model(post.__class__),
                        object_id=post.id,
                        item_name='',
                        price=0 if single_price_data['undetermined'] else int(single_price_data['price']),
                        is_price_undetermined=single_price_data['undetermined']
                    )
                elif item_price_formset:
                    save_item_prices_from_formset(item_price_formset, post)

                # 교환 정보
                if category == 'sell':
                    save_exchange_info(request, post)

                # 분철 가격 저장
                if category == 'split' and formset:
                    for sp_form in formset:
                        if sp_form.cleaned_data.get('price'):
                            sp_instance = sp_form.save(commit=False)
                            sp_instance.post = post
                            sp_instance.save()
                    post.checked_out_members.set(selected_member_ids)
                else:
                    post.members.set(selected_member_ids)

                form.save_m2m()

                # 이미지 저장
                content_type = ContentType.objects.get_for_model(post.__class__)
                for idx, image in enumerate(image_files):
                    FarmPostImage.objects.create(
                        image=image,
                        content_type=content_type,
                        object_id=post.id,
                        is_representative=(idx == 0)
                    )

                return redirect('ddokfarm:post_detail', category=category, post_id=post.id)
    else:
        form = form_class()
        item_price_formset = get_item_price_formset() if category in ['sell', 'rental'] else None
        formset = None

    # 폼 렌더링용 컨텍스트
    selected_members = []
    formset_with_names = None
    if category == 'split' and default_artist_id:
        selected_members = Member.objects.filter(artist_name__id=default_artist_id).distinct()
        initial_data = [{'member': m.id} for m in selected_members]
        SplitPriceFormSet = modelformset_factory(SplitPrice, form=SplitPriceForm, extra=len(initial_data), can_delete=False)
        formset = SplitPriceFormSet(queryset=SplitPrice.objects.none(), initial=initial_data, prefix='splitprice')
        member_names = [m.member_name for m in selected_members]
        formset_with_names = zip(formset, member_names)

    context = {
        'form': form,
        'item_price_formset': item_price_formset,
        'formset': formset,
        'formset_with_names': formset_with_names,
        'category': category,
        'sorted_artists': favorite_artists,
        'default_artist_id': default_artist_id,
        'selected_members': selected_members,
        'selected_member_ids': selected_member_ids,
        'post': None,
        'submit_label': '작성 완료',
        'cancel_url': reverse('ddokfarm:index'),
        'mode': 'create',
        'categories': get_ddokfarm_categories(),
        'ajax_base_url': '/ddokfarm/ajax',
    }
    return render(request, 'ddokfarm/create.html', context)

# 분철 폼셋 (기존과 동일)
@login_required
def load_split_members_and_prices(request):
    artist_id = request.GET.get('artist_id')
    if not artist_id:
        return JsonResponse({'error': '아티스트 ID가 필요합니다.'}, status=400)

    members = Member.objects.filter(artist_name__id=artist_id).distinct()
    initial_data = [{'member': m.id} for m in members]

    SplitPriceFormSet = modelformset_factory(SplitPrice, form=SplitPriceForm, extra=len(initial_data), can_delete=False)
    formset = SplitPriceFormSet(
        queryset=SplitPrice.objects.none(),
        initial=initial_data,
        prefix='splitprice'
    )

    member_names = [m.member_name for m in members]
    formset_with_names = zip(formset, member_names)

    formset_html = render_to_string(
        'ddokfarm/components/post_form/_splitprice_formset.html',
        {
            'formset': formset,
            'formset_with_names': formset_with_names,
            'selected_member_ids': [],
        },
        request=request
    )

    return JsonResponse({
        'members': [{'id': m.id, 'name': m.member_name} for m in members],
        'formset_html': formset_html,
    })

# 아티스트 검색 (기존과 동일)
@login_required
def search_artists(request):
    query = request.GET.get('q', '')
    if query:
        results = Artist.objects.filter(
            Q(display_name__icontains=query) |
            Q(korean_name__icontains=query) |
            Q(english_name__icontains=query) |
            Q(alias__icontains=query)
        )[:10]
    else:
        results = []

    data = {
        "results": [
            {"id": artist.id, "name": artist.display_name}
            for artist in results
        ]
    }

    return JsonResponse(data)

# views.py에서 post_edit 함수 수정

@login_required
def post_edit(request, category, post_id):
    model = get_post_model(category)
    form_class = get_post_form(category)

    if not model or not form_class:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)
    
    # 권한 확인
    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '이 게시글을 수정할 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    # 거래 완료된 게시글 수정 방지
    if post.is_sold:
        context = {
            'title': '수정 불가',
            'message': '거래가 완료된 게시글은 수정할 수 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    if request.method == 'POST':
        post_data = request.POST.copy()
        
        # 아티스트 변경 방지 - 기존 아티스트 ID로 강제 설정
        post_data['artist'] = post.artist.id
        
        form = form_class(post_data, request.FILES, instance=post)
        price_mode = post_data.get('price_mode')
        is_single_mode = price_mode == 'single'
        
        # 멤버 선택은 변경 가능
        selected_member_ids = list(map(int, post_data.getlist('members')))
        
        image_files = request.FILES.getlist('images')
        removed_ids = [int(id) for id in post_data.get('removed_image_ids', '').split(',') if id.isdigit()]

        # 가격 처리 (판매/대여)
        item_price_formset = None
        single_price_data = None
        if category in ['sell', 'rental']:
            if is_single_mode:
                price = post_data.get('single_price', '').strip()
                undetermined = post_data.get('single_price_undetermined') == 'on'
                single_price_data = {'price': price, 'undetermined': undetermined}
                item_price_formset = get_item_price_formset(post=post, data=None)
            else:
                item_price_formset = get_item_price_formset(post=post, data=post_data)

        # 분철 formset 처리
        formset_with_names = []
        if category == 'split':
            selected_members = Member.objects.filter(artist_name=post.artist).distinct()
            splitprice_dict = {sp.member_id: sp for sp in post.member_prices.all()}
            for member in selected_members:
                sp_form = SplitPriceForm(
                    post_data, 
                    prefix=f'splitprice-{member.id}', 
                    instance=splitprice_dict.get(member.id)
                )
                sp_form.fields['member'].initial = member.id
                if str(member.id) in post_data.getlist('members'):
                    sp_form.fields['price'].required = False
                    sp_form.fields['price'].widget.attrs.pop('required', None)
                formset_with_names.append((sp_form, member.member_name))

        # 유효성 검사
        form_valid = form.is_valid()
        item_price_formset_valid = True
        split_formset_valid = True
        
        # 가격 FormSet 검증
        if item_price_formset and not is_single_mode:
            item_price_formset_valid = item_price_formset.is_valid()
        
        # 분철 FormSet 검증
        if formset_with_names:
            split_formset_valid = all(f.is_valid() for f, _ in formset_with_names)

        # 단일 가격 모드 검증
        if is_single_mode and category in ['sell', 'rental']:
            if not single_price_data['price'] and not single_price_data['undetermined']:
                form.add_error(None, "가격을 입력하거나 '가격 미정'을 선택해주세요.")
                item_price_formset_valid = False

        # 모든 검증이 통과하면 저장
        if form_valid and item_price_formset_valid and split_formset_valid:
            # 기본 게시글 저장
            post = form.save(commit=False)
            # 아티스트는 절대 변경되지 않도록 다시 한번 설정
            original_artist = get_object_or_404(model, id=post_id).artist
            post.artist = original_artist
            post.save()

            # 가격 정보 저장 (판매/대여)
            if category in ['sell', 'rental']:
                # 기존 가격 정보 삭제
                content_type = ContentType.objects.get_for_model(post.__class__)
                if item_price_formset:
                    save_item_prices_from_formset(item_price_formset, post)
                
                # 새 가격 정보 저장
                if is_single_mode and single_price_data:
                    # 단일 가격 모드
                    ItemPrice.objects.create(
                        content_type=content_type,
                        object_id=post.id,
                        item_name='',
                        price=0 if single_price_data['undetermined'] else int(single_price_data['price']),
                        is_price_undetermined=single_price_data['undetermined']
                    )
                elif item_price_formset:
                    # 다중 가격 모드
                    save_item_prices_from_formset(item_price_formset, post)

            # 교환 정보 저장 (판매만)
            if category == 'sell':
                save_exchange_info(request, post)

            # 멤버 및 분철 정보 저장
            if category == 'split':
                # 기존 분철 가격 삭제
                post.member_prices.all().delete()
                
                # 새 분철 가격 저장
                for sp_form, _ in formset_with_names:
                    if sp_form.cleaned_data:
                        member_id = sp_form.cleaned_data.get('member')
                        if member_id and member_id.id not in selected_member_ids:
                            price = sp_form.cleaned_data.get('price')
                            if price:
                                sp_instance = sp_form.save(commit=False)
                                sp_instance.post = post
                                sp_instance.save()
                
                # 마감 멤버 설정
                post.checked_out_members.set(selected_member_ids)
            else:
                # 일반 멤버 설정 (판매/대여)
                post.members.set(selected_member_ids)

            # 이미지 처리
            if removed_ids:
                # 삭제된 이미지 제거
                post.images.filter(id__in=removed_ids).delete()
                
            if image_files:
                # 새 이미지 추가
                content_type = ContentType.objects.get_for_model(post.__class__)
                existing_count = post.images.count()
                
                for idx, image in enumerate(image_files):
                    FarmPostImage.objects.create(
                        image=image,
                        content_type=content_type,
                        object_id=post.id,
                        is_representative=(existing_count == 0 and idx == 0)
                    )

            # Many-to-Many 관계 저장
            form.save_m2m()
            
            return redirect('ddokfarm:post_detail', category=category, post_id=post.id)

    else:
        # GET 요청 - 수정 폼 표시
        form = form_class(instance=post)
        
        # 가격 FormSet 초기화 (판매/대여)
        item_price_formset = None
        if category in ['sell', 'rental']:
            item_price_formset = get_item_price_formset(post=post)
        
        # 분철 FormSet 초기화
        formset_with_names = []
        if category == 'split':
            selected_members = Member.objects.filter(artist_name=post.artist).distinct()
            splitprice_dict = {sp.member_id: sp for sp in post.member_prices.all()}
            
            for member in selected_members:
                sp_form = SplitPriceForm(
                    prefix=f'splitprice-{member.id}', 
                    instance=splitprice_dict.get(member.id)
                )
                sp_form.fields['member'].initial = member.id
                formset_with_names.append((sp_form, member.member_name))

    # 🔧 기존 ItemPrice 데이터를 JavaScript로 전달
    existing_item_prices = []
    if category in ['sell', 'rental']:
        item_prices = post.get_item_prices().order_by('id')
        for item in item_prices:
            existing_item_prices.append({
                'id': item.id,
                'item_name': item.item_name,
                'price': item.price,
                'is_price_undetermined': item.is_price_undetermined,
            })

    # 템플릿 컨텍스트
    context = {
        'form': form,
        'item_price_formset': item_price_formset,
        'formset_with_names': formset_with_names,
        'category': category,
        'post': post,
        'mode': 'edit',
        'submit_label': '수정 완료',
        'cancel_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        'sorted_artists': Artist.objects.order_by('display_name'),
        'selected_members': Member.objects.filter(artist_name=post.artist),
        'selected_member_ids': (
            list(post.checked_out_members.values_list('id', flat=True)) 
            if category == 'split' 
            else list(post.members.values_list('id', flat=True))
        ),
        'selected_artist_id': post.artist.id,
        'existing_images': [
            {
                "id": img.id, 
                "url": img.image.url if img.image else f"{settings.MEDIA_URL}default.jpg"
            }
            for img in post.images.all()
        ],
        # 🔧 기존 ItemPrice 데이터 추가
        'existing_item_prices': existing_item_prices,
        'categories': get_ddokfarm_categories(),
        'ajax_base_url': '/ddokfarm/ajax',
    }

    return render(request, 'ddokfarm/edit.html', context)

# 게시글 삭제
@login_required
def post_delete(request, category, post_id):
    model = get_post_model(category)
    if not model:
        return JsonResponse({'success': False, 'message': '존재하지 않는 카테고리입니다.'})

    post = get_object_or_404(model, id=post_id)

    # 권한 확인
    if request.user != post.user:
        return JsonResponse({'success': False, 'message': '이 게시글을 삭제할 권한이 없습니다.'})

    # GET 요청: 삭제 가능 여부 확인
    if request.method == 'GET':
        content_type = ContentType.objects.get_for_model(post)
        
        # 거래가 완료되지 않고 취소되지 않은 채팅방 찾기
        active_chatrooms = ChatRoom.objects.filter(
            content_type=content_type,
            object_id=post.id,
            is_cancelled=False
        ).exclude(
            Q(buyer_completed=True) & Q(seller_completed=True)
        )
        
        if active_chatrooms.exists():
            return JsonResponse({
                'can_delete': False,
                'message': '진행 중인 거래가 있어 삭제할 수 없습니다.'
            })
        
        return JsonResponse({'can_delete': True})
    
    # POST 요청: 실제 삭제
    elif request.method == 'POST':
        # 다시 한번 체크 (동시성 문제 방지)
        content_type = ContentType.objects.get_for_model(post)
        active_chatrooms = ChatRoom.objects.filter(
            content_type=content_type,
            object_id=post.id,
            is_cancelled=False
        ).exclude(
            Q(buyer_completed=True) & Q(seller_completed=True)
        )
        
        if active_chatrooms.exists():
            return JsonResponse({'success': False, 'message': '진행 중인 거래가 있어 삭제할 수 없습니다.'})
        
        post.delete()
        return JsonResponse({
            'success': True, 
            'redirect_url': f"{reverse('ddokfarm:index')}?category={category}"
        })
    
    else:
        return JsonResponse({'success': False, 'message': '허용되지 않는 요청 방식입니다.'})

# 댓글 작성 (기존과 동일)
@login_required
@require_POST
def comment_create(request, category, post_id):
    post_model = get_post_model(category)
    if not post_model:
        raise Http404("존재하지 않는 카테고리입니다.")
    post = get_object_or_404(post_model, id=post_id)

    form = FarmCommentForm(request.POST)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.user = request.user

        # 연결된 게시글 설정
        comment.content_type = ContentType.objects.get_for_model(post.__class__)
        comment.object_id = post.id

        # 대댓글이면 부모 댓글 설정
        parent_id = request.POST.get("parent")
        if parent_id:
            comment.parent = get_object_or_404(FarmComment, id=parent_id)

        comment.save()

        # ✅ AJAX 요청일 경우, HTML 조각 반환
        if request.headers.get("x-requested-with") == "XMLHttpRequest":
            html = render_to_string(
                "components/post_detail/_comment_list.html",
                {
                    "comment": comment,
                    "is_reply": bool(parent_id),
                    "post": post,
                    "category": category,
                    "request": request,
                    "comment_create_url": reverse("ddokfarm:comment_create", args=[category, post_id]),
                }
            )
            return HttpResponse(html)

    # 일반 요청일 경우 fallback (폼 오류 등)
    return redirect("ddokfarm:post_detail", category=category, post_id=post_id)

# 댓글 삭제 (기존과 동일)
@login_required
@require_POST
def comment_delete(request, category, post_id, comment_id):
    comment = get_object_or_404(FarmComment, id=comment_id)

    # 연결된 게시글과 ID 확인
    if not (comment.content_type.model == get_post_model(category)._meta.model_name and comment.object_id == int(post_id)):
        return HttpResponseForbidden()

    if request.user != comment.user:
        return HttpResponseForbidden()

    # 실제 삭제 대신 삭제 표시
    comment.is_deleted = True
    comment.content = "삭제된 댓글입니다"
    comment.save()

    # ✅ AJAX 요청이면 HTML 반환 대신 204 응답
    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return HttpResponse(status=204)

    # ✅ 일반 요청일 경우 페이지 리다이렉트
    return redirect('ddokfarm:post_detail', category=category, post_id=post_id)

# 좋아요(찜하기) (기존과 동일)
@login_required
@require_POST
def like_post(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    if request.user in post.like.all():
        post.like.remove(request.user)
        liked = False
    else:
        post.like.add(request.user)
        liked = True

    return JsonResponse({'liked': liked, 'like_count': post.like.count()})

# 판매 완료 표시
@login_required
@require_POST
def mark_as_sold(request, category, post_id):
    # 🔹 1. 카테고리 → 모델 매핑 함수 또는 직접 매핑
    def get_post_model(category):
        return {
            'sell': FarmSellPost,
            'rental': FarmRentalPost,
            'split': FarmSplitPost,
        }.get(category)

    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    # 🔹 2. 게시글 조회
    post = get_object_or_404(model, id=post_id)

    # 🔹 3. 권한 확인
    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '판매 완료 처리를 할 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    # 🔥 4. 이미 거래완료된 경우 처리 불가
    if post.is_sold:
        context = {
            'title': '처리 불가',
            'message': '이미 거래가 완료된 게시글입니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    # 🔥 5. 트랜잭션으로 게시글과 채팅방 동시 업데이트 (토글 → 완료만)
    with transaction.atomic():
        # 게시글을 거래완료로 설정 (되돌릴 수 없음)
        post.is_sold = True
        post.save()

        # 🔥 6. 연결된 모든 채팅방의 seller_completed를 True로 설정
        content_type = ContentType.objects.get_for_model(post)
        updated_count = ChatRoom.objects.filter(
            content_type=content_type, 
            object_id=post_id,
            seller_completed=False  # 아직 완료하지 않은 채팅방만
        ).update(seller_completed=True)
        
        print(f"✅ 게시글 거래완료 → 채팅방 동기화: {updated_count}개 채팅방의 seller_completed = True")

    # 🔹 7. 리디렉션
    return redirect('ddokfarm:post_detail', category=category, post_id=post.id)

# 아티스트 선택시 멤버 목록 출력 (기존과 동일)
def get_members_by_artist(request, artist_id):
    members = Member.objects.filter(artist_name__id=artist_id).distinct()
    member_data = [
        {"id": member.id, "name": member.member_name}
        for member in members
    ]
    
    return JsonResponse({"members": member_data})

# 분철 참여 신청 (기존과 동일)
@login_required
@require_POST
def split_application(request, category, post_id):
    if category != 'split':
        return JsonResponse({'success': False, 'message': '분철 게시글이 아닙니다.'}, status=400)
    
    post = get_object_or_404(FarmSplitPost, id=post_id)
    selected_member_ids = request.POST.getlist('selected_members')
    
    if not selected_member_ids:
        return JsonResponse({'success': False, 'message': '멤버를 선택해주세요.'}, status=400)
    
    # 이미 마감된 멤버인지 확인
    selected_members = Member.objects.filter(id__in=selected_member_ids)
    
    # 승인된 신청에서 마감된 멤버들 확인
    approved_applications = SplitApplication.objects.filter(
        post=post, 
        status='approved'
    ).prefetch_related('members')
    
    approved_member_ids = set()
    for app in approved_applications:
        for member in app.members.all():
            approved_member_ids.add(member.id)
    
    # 수동 마감 + 승인된 신청 멤버들
    manual_checked_out = post.checked_out_members.values_list('id', flat=True)
    all_checked_out_ids = set(manual_checked_out) | approved_member_ids
    
    # 선택한 멤버 중 마감된 멤버가 있는지 확인
    conflicting_members = selected_members.filter(id__in=all_checked_out_ids)
    if conflicting_members.exists():
        return JsonResponse({
            'success': False, 
            'message': f'{", ".join(conflicting_members.values_list("member_name", flat=True))} 멤버는 이미 마감되었습니다.'
        })
    
    # 항상 새로운 신청 생성 (기존 신청 확인 로직 제거)
    application = SplitApplication.objects.create(
        post=post, 
        user=request.user,
        status='pending'
    )
    application.members.set(selected_members)
    
    return JsonResponse({
        'success': True, 
        'message': f'{len(selected_member_ids)}명의 멤버 신청이 완료되었습니다. 총대의 승인을 기다려주세요.'
    })

# 분철 참여자 관리 (기존과 동일)
@login_required
def manage_split_applications(request, category, post_id):
    if category != 'split':
        raise Http404("분철 게시글이 아닙니다.")
    
    post = get_object_or_404(FarmSplitPost, id=post_id)
    
    # 작성자만 접근 가능
    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '참여자 관리 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)
    
    # 최신 신청순으로 정렬 (기존과 동일)
    applications = SplitApplication.objects.filter(post=post).prefetch_related('members', 'user').order_by('-created_at')
    
    # 상태별 개수 계산 (기존과 동일)
    pending_count = applications.filter(status='pending').count()
    approved_count = applications.filter(status='approved').count()
    rejected_count = applications.filter(status='rejected').count()
    
    # ✅ 새로 추가: 승인된 참여자들을 사용자별로 그룹화 (채팅용)
    approved_users_for_chat = {}
    for app in applications.filter(status='approved'):
        user_id = app.user.id
        if user_id not in approved_users_for_chat:
            approved_users_for_chat[user_id] = {
                'user': app.user,
                'approved_members': set(),
                'latest_approved_date': app.created_at,
            }
        
        # 승인된 멤버들 추가
        member_names = app.members.values_list('member_name', flat=True)
        approved_users_for_chat[user_id]['approved_members'].update(member_names)
        
        # 가장 최근 승인일 업데이트
        if app.created_at > approved_users_for_chat[user_id]['latest_approved_date']:
            approved_users_for_chat[user_id]['latest_approved_date'] = app.created_at
    
    # 최신 승인일 순으로 정렬
    approved_users_list = sorted(
        approved_users_for_chat.values(),
        key=lambda x: x['latest_approved_date'],
        reverse=True
    )
    
    context = {
        'post': post,
        'category': category,
        'applications': applications,  # 기존 전체 히스토리
        'approved_users_for_chat': approved_users_list,  # ✅ 새로 추가: 채팅용 그룹화된 사용자
        'pending_count': pending_count,
        'approved_count': len(approved_users_list),  # ✅ 참여자 수 기준으로 변경
        'rejected_count': rejected_count,
    }
    
    return render(request, 'ddokfarm/manage_applications.html', context)

# 신청 상태 업데이트 (기존과 동일)
@login_required
@require_POST
def update_application_status(request, category, post_id):
    if category != 'split':
        return JsonResponse({'success': False, 'message': '분철 게시글이 아닙니다.'}, status=400)
    
    post = get_object_or_404(FarmSplitPost, id=post_id)
    
    if request.user != post.user:
        return JsonResponse({'success': False, 'message': '권한이 없습니다.'}, status=403)
    
    application_id = request.POST.get('application_id')
    status = request.POST.get('status')
    
    if status not in ['approved', 'rejected']:
        return JsonResponse({'success': False, 'message': '유효하지 않은 상태입니다.'}, status=400)
    
    application = get_object_or_404(SplitApplication, id=application_id, post=post)
    
    # 상태만 변경 (checked_out_members는 detail 뷰에서 자동으로 처리)
    application.status = status
    application.save()
    
    return JsonResponse({
        'success': True, 
        'message': f'신청이 {"승인" if status == "approved" else "반려"}되었습니다.'
    })