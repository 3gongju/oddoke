from django.template.loader import render_to_string
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponseForbidden, HttpResponseNotAllowed
from django.views.decorators.http import require_POST, require_GET
from django.http import JsonResponse, HttpResponse
from django.urls import reverse
from django.db.models import Q, F
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from django.forms import modelformset_factory
from django.utils import timezone
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
)
from .forms import FarmCommentForm, SplitPriceForm
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
# ✅ 홈 화면 (루트 URL)
def main(request):
    return render(request, 'main/home.html')


# 전체 게시글 보기
def index(request):
    category = request.GET.get('category')
    wantto = request.GET.get('wantto')
    query = request.GET.get('q', '').strip()
    sort_by = request.GET.get('sort', 'latest')
    show_available_only = request.GET.get('available_only') == 'on'
    
    # 필터링 파라미터
    selected_shipping = request.GET.get('shipping', '')
    selected_conditions = request.GET.getlist('condition')
    selected_md = request.GET.getlist('md')
    min_price = request.GET.get('min_price', '')
    max_price = request.GET.get('max_price', '')

    # 기본 필터링 조건 구성
    filter_conditions = Q()
    
    if selected_shipping:
        filter_conditions &= Q(shipping=selected_shipping)
    
    if selected_conditions:
        condition_q = Q()
        for condition in selected_conditions:
            condition_q |= Q(condition=condition)
        filter_conditions &= condition_q
    
    # ✅ MD 필터링 - 판매 게시글에만 적용
    sell_md_conditions = Q()
    if selected_md:
        md_q = Q()
        for md in selected_md:
            md_q |= Q(md=md)
        sell_md_conditions = md_q
    
    # 가격 필터링
    price_conditions = Q()
    if min_price:
        try:
            min_price_val = float(min_price)
            price_conditions &= Q(price__gte=min_price_val)
        except ValueError:
            min_price = ''
    
    if max_price:
        try:
            max_price_val = float(max_price)
            price_conditions &= Q(price__lte=max_price_val)
        except ValueError:
            max_price = ''

    # want_to 필터링
    wantto_conditions = Q()
    if wantto:
        wantto_conditions &= Q(want_to=wantto)

    if query:
        # 검색 로직
        artist_filter = (
            Q(artist__display_name__icontains=query) |
            Q(artist__korean_name__icontains=query) |
            Q(artist__english_name__icontains=query) |
            Q(artist__alias__icontains=query)
        )
        member_filter = Q(members__member_name__icontains=query)
        text_filter = Q(title__icontains=query) | Q(content__icontains=query)
        common_filter = text_filter | artist_filter | member_filter

        # ✅ 판매 게시글 - MD 필터 포함
        sell_results = FarmSellPost.objects.filter(
            common_filter & filter_conditions & price_conditions & wantto_conditions & sell_md_conditions
        ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'images').distinct()
        
        # ✅ 대여 게시글 - MD 필터 제외
        rental_results = FarmRentalPost.objects.filter(
            common_filter & filter_conditions & price_conditions & wantto_conditions
        ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'images').distinct()
        
        # 분철은 기존과 동일
        split_filter = text_filter | artist_filter | Q(member_prices__member__member_name__icontains=query)
        split_price_filter = Q()
        if min_price:
            try:
                split_price_filter &= Q(member_prices__price__gte=float(min_price))
            except ValueError:
                pass
        if max_price:
            try:
                split_price_filter &= Q(member_prices__price__lte=float(max_price))
            except ValueError:
                pass
            
        split_results = FarmSplitPost.objects.filter(
            split_filter & split_price_filter
        ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'member_prices', 'images').distinct()

        posts = list(chain(sell_results, rental_results, split_results))
    else:
        # 카테고리별 필터링
        if category == 'sell':
            # ✅ 판매 - MD 필터 포함
            posts = FarmSellPost.objects.filter(
                filter_conditions & price_conditions & wantto_conditions & sell_md_conditions
            ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'images')
        elif category == 'rental':
            # ✅ 대여 - MD 필터 제외
            posts = FarmRentalPost.objects.filter(
                filter_conditions & price_conditions & wantto_conditions
            ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'images')
        elif category == 'split':
            # 분철은 기존과 동일
            split_price_filter = Q()
            if min_price:
                try:
                    split_price_filter &= Q(member_prices__price__gte=float(min_price))
                except ValueError:
                    pass
            if max_price:
                try:
                    split_price_filter &= Q(member_prices__price__lte=float(max_price))
                except ValueError:
                    pass
            posts = FarmSplitPost.objects.filter(
                split_price_filter
            ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'member_prices', 'images').distinct()
        else:
            # ✅ 전체 카테고리 - 각각 다르게 필터링
            sell_posts = FarmSellPost.objects.filter(
                filter_conditions & price_conditions & wantto_conditions & sell_md_conditions
            ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'images')
            
            rental_posts = FarmRentalPost.objects.filter(
                filter_conditions & price_conditions & wantto_conditions
            ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'images')
            
            split_price_filter = Q()
            if min_price:
                try:
                    split_price_filter &= Q(member_prices__price__gte=float(min_price))
                except ValueError:
                    pass
            if max_price:
                try:
                    split_price_filter &= Q(member_prices__price__lte=float(max_price))
                except ValueError:
                    pass
            split_posts = FarmSplitPost.objects.filter(
                split_price_filter
            ).select_related('user', 'artist', 'user__fandom_profile').prefetch_related('like', 'member_prices', 'images').distinct()
            
            posts = list(chain(sell_posts, rental_posts, split_posts))

        if not isinstance(posts, list):
            posts = list(posts)

    # 판매중 필터 적용 (기존과 동일)
    if show_available_only:
        posts = [post for post in posts if not post.is_sold]

    # 정렬 로직 (기존과 동일)
    if sort_by == 'latest':
        posts = sorted(posts, key=attrgetter('created_at'), reverse=True)
    elif sort_by == 'price_low':
        posts = sorted(posts, key=lambda x: getattr(x, 'price', float('inf')))
    elif sort_by == 'price_high':
        posts = sorted(posts, key=lambda x: getattr(x, 'price', 0), reverse=True)
    elif sort_by == 'likes':
        posts = sorted(posts, key=lambda x: x.like.count(), reverse=True)
    else:
        posts = sorted(posts, key=attrgetter('created_at'), reverse=True)

    for post in posts:
        post.detail_url = reverse('ddokfarm:post_detail', args=[post.category_type, post.id])

    clean_category = (request.GET.get('category') or 'sell').split('?')[0]

    # 필터 표시용 데이터 생성 (기존과 동일)
    shipping_choices = dict(FarmSellPost.SHIPPING_CHOICES)
    condition_choices = dict(FarmSellPost.CONDITION_CHOICES)
    md_choices = dict(FarmSellPost.MD_CHOICES)  # ✅ 새로 추가
    
    # 상품 상태 표시 매핑 생성
    condition_display_map = {}
    for condition in selected_conditions:
        condition_display_map[condition] = condition_choices.get(condition, condition)
    
    # ✅ 새로 추가: MD 종류 표시 매핑 생성
    md_display_map = {}
    for md in selected_md:
        md_display_map[md] = md_choices.get(md, md)
    
    context = {
        'posts': posts,
        'category': category,
        'wantto': wantto,  # 템플릿에서는 wantto로 사용
        'query': query,
        'sort_by': sort_by,
        'show_available_only': show_available_only,
        'search_action': reverse('ddokfarm:index'),
        'create_url': f"{reverse('ddokfarm:post_create')}?category={clean_category}",
        'category_urls': get_ddokfarm_category_urls(),
        'default_category': 'sell',
        
        # 필터링 관련 컨텍스트 (기존과 동일)
        'selected_shipping': selected_shipping,
        'selected_conditions': selected_conditions,
        'selected_md': selected_md,  # ✅ 새로 추가
        'min_price': min_price,
        'max_price': max_price,
        'selected_shipping_display': shipping_choices.get(selected_shipping, ''),
        'condition_display_map': condition_display_map,
        'md_display_map': md_display_map,  # ✅ 새로 추가
    }

    return render(request, 'ddokfarm/index.html', context)

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

    # 개별 가격 정보 추가
    if category in ['sell', 'rental']:
        item_prices = post.get_item_prices().order_by('id')
        context['item_prices'] = item_prices
        context['has_individual_prices'] = item_prices.exists()

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

# 게시글 작성하기
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
        form = form_class(request.POST, request.FILES)

        if category == 'split' and selected_artist_id:
            selected_members = Member.objects.filter(artist_name__id=selected_artist_id).distinct()
            initial_data = [{'member': m.id} for m in selected_members]
            SplitPriceFormSet = modelformset_factory(SplitPrice, form=SplitPriceForm, extra=len(initial_data), can_delete=False)
            formset = SplitPriceFormSet(
                request.POST,
                prefix='splitprice',
                queryset=SplitPrice.objects.none(),
                initial=initial_data
            )
        else:
            formset = None

        if form.is_valid() and (formset.is_valid() if formset else True):
            if not image_files:
                form.add_error(None, "이미지는 최소 1장 이상 업로드해야 합니다.")
            else:
                post = form.save(commit=False)
                post.user = request.user
                if selected_artist_id:
                    post.artist_id = selected_artist_id

                # 개별 가격 설정 처리
                use_individual_prices = request.POST.get('use_individual_prices')
                if use_individual_prices and category in ['sell', 'rental']:
                    # 개별 가격 설정이 체크된 경우 기본 가격을 0으로 설정
                    post.price = 0

                post.save()

                # 개별 가격 저장 (판매/대여만)
                if use_individual_prices and category in ['sell', 'rental']:
                    save_individual_prices(request, post)

                if category == 'split' and formset:
                    for idx, sp_form in enumerate(formset.forms):
                        member_field = sp_form.cleaned_data.get('member')
                        price_field = sp_form.cleaned_data.get('price')
                        if not member_field:
                            member_id = sp_form.initial.get('member')
                            if member_id:
                                member_field = Member.objects.get(id=member_id)

                        if member_field and member_field.id not in selected_member_ids and price_field:
                            sp_instance = sp_form.save(commit=False)
                            sp_instance.post = post
                            sp_instance.member = member_field
                            sp_instance.save()

                    post.checked_out_members.set(selected_member_ids)
                else:
                    post.members.set(selected_member_ids)

                form.save_m2m()

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
        formset = None

    selected_members = []
    formset_with_names = None
    if category == 'split' and default_artist_id:
        selected_members = Member.objects.filter(artist_name__id=default_artist_id).distinct()
        initial_data = [{'member': m.id} for m in selected_members]
        SplitPriceFormSet = modelformset_factory(SplitPrice, form=SplitPriceForm, extra=len(initial_data), can_delete=False)
        formset = SplitPriceFormSet(
            queryset=SplitPrice.objects.none(),
            initial=initial_data,
            prefix='splitprice'
        )
        member_names = [m.member_name for m in selected_members]
        formset_with_names = zip(formset, member_names)

    context = {
        'form': form,
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
        **get_ajax_base_context(request),
        'mode': 'create',
        'categories': get_ddokfarm_categories(),
    }
    return render(request, 'ddokfarm/create.html', context)

# 분철 폼셋
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
            'selected_member_ids': [],  # ✅ 빈 리스트 (아무도 체크되지 않은 상태)
        },
        request=request
    )

    return JsonResponse({
        'members': [{'id': m.id, 'name': m.member_name} for m in members],
        'formset_html': formset_html,
    })

# 아티스트 검색
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

# 게시글 수정
@login_required
def post_edit(request, category, post_id):
    model = get_post_model(category)
    form_class = get_post_form(category)

    if not model or not form_class:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '이 게시글을 수정할 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    if request.method == 'POST':
        # artist 수정 불가: 기존 artist로 강제 세팅
        post_data = request.POST.copy()
        post_data['artist'] = post.artist.id

        form = form_class(post_data, request.FILES, instance=post)
        image_files = request.FILES.getlist('images')
        removed_ids = post_data.get('removed_image_ids', '').split(',')
        removed_ids = [int(id) for id in removed_ids if id.isdigit()]
        selected_member_ids = list(map(int, post_data.getlist('members')))

        if category == 'split':
            selected_members = Member.objects.filter(artist_name=post.artist).distinct()
            splitprice_dict = {sp.member_id: sp for sp in post.member_prices.all()}

            formset_with_names = []
            for member in selected_members:
                sp_instance = splitprice_dict.get(member.id)
                sp_form = SplitPriceForm(
                    post_data,
                    prefix=f'splitprice-{member.id}',
                    instance=sp_instance
                )
                sp_form.fields['member'].initial = member.id

                # ✅ 체크된 멤버는 price.required=False
                if str(member.id) in post_data.getlist('members'):
                    sp_form.fields['price'].required = False
                    sp_form.fields['price'].widget.attrs.pop('required', None)

                formset_with_names.append((sp_form, member.member_name))

            # ✅ dummy formset for management_form
            SplitPriceFormSet = modelformset_factory(SplitPrice, form=SplitPriceForm, extra=0, can_delete=False)
            dummy_formset = SplitPriceFormSet(queryset=SplitPrice.objects.none(), prefix='splitprice')
        else:
            formset_with_names = None
            dummy_formset = None

        formset_valid = all(form.is_valid() for form, _ in formset_with_names) if formset_with_names else True

        if form.is_valid() and formset_valid:
            post = form.save(commit=False)

            # 개별 가격 설정 처리
            use_individual_prices = post_data.get('use_individual_prices')
            if category in ['sell', 'rental']:
                if use_individual_prices:
                    # 개별 가격 설정이 체크된 경우
                    # 기존 개별 가격들 삭제
                    post.get_item_prices().delete()
                    # 새로운 개별 가격들 저장
                    save_individual_prices(request, post)
                    # 기본 가격을 0으로 설정
                    post.price = 0
                else:
                    # 개별 가격 설정이 해제된 경우 기존 개별 가격들 삭제
                    post.get_item_prices().delete()

            post.save()

            if category == 'split' and formset_with_names:
                post.member_prices.all().delete()
                for sp_form, _ in formset_with_names:
                    member_id = sp_form.cleaned_data.get('member').id
                    if member_id not in selected_member_ids:
                        if sp_form.cleaned_data.get('price'):
                            sp_instance = sp_form.save(commit=False)
                            sp_instance.post = post
                            sp_instance.save()
                post.checked_out_members.set(selected_member_ids)
            else:
                post.members.set(selected_member_ids)

            if removed_ids:
                post.images.filter(id__in=removed_ids).delete()

            if image_files:
                content_type = ContentType.objects.get_for_model(post.__class__)
                for idx, image in enumerate(image_files):
                    FarmPostImage.objects.create(
                        image=image,
                        content_type=content_type,
                        object_id=post.id,
                        is_representative=(idx == 0)
                    )

            form.save_m2m()
            return redirect('ddokfarm:post_detail', category=category, post_id=post.id)

    else:
        form = form_class(instance=post)

        if category == 'split':
            selected_members = Member.objects.filter(artist_name=post.artist).distinct()
            splitprice_dict = {sp.member_id: sp for sp in post.member_prices.all()}

            formset_with_names = []
            for member in selected_members:
                sp_instance = splitprice_dict.get(member.id)
                sp_form = SplitPriceForm(
                    prefix=f'splitprice-{member.id}',
                    instance=sp_instance
                )
                sp_form.fields['member'].initial = member.id
                formset_with_names.append((sp_form, member.member_name))

            # dummy formset for management_form
            SplitPriceFormSet = modelformset_factory(SplitPrice, form=SplitPriceForm, extra=0, can_delete=False)
            dummy_formset = SplitPriceFormSet(queryset=SplitPrice.objects.none(), prefix='splitprice')
        else:
            formset_with_names = None
            dummy_formset = None

    existing_images = [
        {"id": img.id, "url": img.image.url if img.image else f"{settings.MEDIA_URL}default.jpg"}
        for img in post.images.all()
    ]
    sorted_artists = Artist.objects.order_by('display_name')
    selected_members = Member.objects.filter(artist_name=post.artist).distinct()
    selected_member_ids = (
        list(post.checked_out_members.values_list('id', flat=True))
        if category == 'split' else list(post.members.values_list('id', flat=True))
    )
    selected_artist_id = post.artist.id if post.artist else None

    context = {
        'form': form,
        'post': post,
        'category': category,
        'sorted_artists': sorted_artists,
        'selected_members': selected_members,
        'selected_member_ids': selected_member_ids,
        'selected_artist_id': selected_artist_id,
        'formset_with_names': formset_with_names,
        'formset': dummy_formset,
        'submit_label': '수정 완료',
        'cancel_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        'mode': 'edit',
        'categories': get_ddokfarm_categories(),
        **get_ajax_base_context(request),
        'existing_images': existing_images,
    }

    return render(request, 'ddokfarm/edit.html', context)

# 개별 가격 저장 헬퍼 함수
def save_individual_prices(request, post):
    """개별 가격 정보를 저장하는 헬퍼 함수"""
    content_type = ContentType.objects.get_for_model(post.__class__)
    
    # POST 데이터에서 개별 가격 정보 추출
    total_forms = int(request.POST.get('item_prices-TOTAL_FORMS', 0))
    
    for i in range(total_forms):
        item_name = request.POST.get(f'item_prices-{i}-item_name', '').strip()
        price_str = request.POST.get(f'item_prices-{i}-price', '')
        
        if price_str:  # 가격이 입력된 경우만 저장
            try:
                price = int(price_str)
                if price > 0:  # 양수인 경우만 저장
                    ItemPrice.objects.create(
                        content_type=content_type,
                        object_id=post.id,
                        item_name=item_name,
                        price=price
                    )
            except (ValueError, TypeError):
                continue  # 잘못된 가격 형식은 무시

# 게시글 삭제
@login_required
def post_delete(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '이 게시글을 삭제할 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }

        return render(request, 'ddokfarm/error_message.html', context)

    if request.method == 'POST':
        post.delete()

        return redirect(f"{reverse('ddokfarm:index')}?category={category}")

    context = {
        'title': '잘못된 접근입니다',
        'message': '게시글 삭제는 버튼을 통해서만 가능합니다.',
        'back_url': reverse('ddokfarm:post_detail', args=[category, post.id])
    }

    return render(request, 'ddokfarm/error_message.html', context)

# 댓글 작성
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

# 댓글 삭제
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

# 좋아요(찜하기)
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

    # 🔹 4. 판매 상태 토글
    post.is_sold = not post.is_sold
    post.save()

    # 🔹 5. 연결된 채팅방의 seller_completed도 같이 업데이트
    content_type = ContentType.objects.get_for_model(post)
    ChatRoom.objects.filter(content_type=content_type, object_id=post_id).update(
        seller_completed=post.is_sold
    )

    # 🔹 6. 리디렉션
    return redirect('ddokfarm:post_detail', category=category, post_id=post.id)

# 아티스트 선택시 멤버 목록 출력
def get_members_by_artist(request, artist_id):
    members = Member.objects.filter(artist_name__id=artist_id).distinct()
    member_data = [
        {"id": member.id, "name": member.member_name}
        for member in members
    ]
    
    return JsonResponse({"members": member_data})

# 분철 참여 신청
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

# ddokfarm/views.py - manage_split_applications 함수 개선
# ddokfarm/views.py - manage_split_applications 함수 개선 (채팅 섹션만)

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