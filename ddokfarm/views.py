from django.template.loader import render_to_string
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponseForbidden, HttpResponseNotAllowed
from django.views.decorators.http import require_POST, require_GET
from django.http import JsonResponse, HttpResponse
from django.urls import reverse
from django.db.models import Q
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from django.forms import formset_factory, Form, IntegerField, HiddenInput, NumberInput, DecimalField
from django import forms
from operator import attrgetter
from itertools import chain
from artist.models import Member, Artist
from .models import FarmComment, FarmSellPost, FarmRentalPost, FarmSplitPost, FarmPostImage, SplitPrice
from .forms import FarmCommentForm, SplitPriceFormSet
from .utils import (
    get_post_model,
    get_post_form,
    get_post_comments,
    get_post_queryset,
    get_ajax_base_context,
    get_ddokfarm_categories,
    get_ddokfarm_category_urls,
)

# ✅ 홈 화면 (루트 URL)
def main(request):
    return render(request, 'main/home.html')


# 전체 게시글 보기
def index(request):
    category = request.GET.get('category')
    query = request.GET.get('q', '').strip()

    if query:
        artist_filter = (
            Q(artist__display_name__icontains=query) |
            Q(artist__korean_name__icontains=query) |
            Q(artist__english_name__icontains=query) |
            Q(artist__alias__icontains=query)
        )
        member_filter = Q(members__member_name__icontains=query)
        text_filter = Q(title__icontains=query) | Q(content__icontains=query)
        common_filter = text_filter | artist_filter | member_filter

        sell_results = FarmSellPost.objects.filter(common_filter).distinct()
        rental_results = FarmRentalPost.objects.filter(common_filter).distinct()
        split_results = FarmSplitPost.objects.filter(common_filter).distinct()

        posts = sorted(
            chain(sell_results, rental_results, split_results),
            key=attrgetter('created_at'),
            reverse=True
        )
    else:
        posts = get_post_queryset(category)
        posts = sorted(posts, key=attrgetter('created_at'), reverse=True)

    for post in posts:
        post.detail_url = reverse('ddokfarm:post_detail', args=[post.category_type, post.id])

    clean_category = (request.GET.get('category') or 'sell').split('?')[0]

    context = {
        'posts': posts,
        'category': category,
        'query': query,
        'search_action': reverse('ddokfarm:index'),
        'create_url': f"{reverse('ddokfarm:post_create')}?category={clean_category}",
        'category_urls': get_ddokfarm_category_urls(),
        'default_category': 'sell',
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
    comment_qs = get_post_comments(post)
    comments = comment_qs.filter(parent__isnull=True).select_related('user').prefetch_related('replies__user')
    total_comment_count = comment_qs.count()
    comment_form = FarmCommentForm()
    is_liked = request.user.is_authenticated and post.like.filter(id=request.user.id).exists()
    comment_create_url = reverse('ddokfarm:comment_create', kwargs={'category': category, 'post_id': post_id})

    if category == 'split':
        members = [sp.member for sp in post.member_prices.select_related('member').all()]
    else:
        members = post.members.all()

    context = {
        'post': post,
        'category': category,
        'comments': comments,
        'total_comment_count': total_comment_count,
        'comment_form': comment_form,
        'is_liked': is_liked,
        'artist': post.artist,
        'members': members,
        'app_name': 'ddokfarm',
        'comment_create_url': comment_create_url,
        'comment_delete_url_name': 'ddokfarm:comment_delete',
    }

    return render(request, 'ddokfarm/detail.html', context)

# 게시글 작성
@login_required
def post_create(request):
    favorite_artists = Artist.objects.filter(followers=request.user)

    # ✅ category, artist_id 기본값 세팅
    raw_category = request.POST.get('category') or request.GET.get('category') or 'sell'
    category = raw_category.split('?')[0]
    selected_artist_id = request.GET.get('artist')
    selected_member_ids = []

    form_class = get_post_form(category)
    if not form_class:
        raise Http404("존재하지 않는 카테고리입니다.")

    # ✅ artist_id 없으면 첫 번째 아티스트로 기본값
    if not selected_artist_id and favorite_artists.exists():
        selected_artist_id = str(favorite_artists[0].id)

    if request.method == 'POST':
        # ✅ POST로도 artist_id를 받도록 보장
        selected_artist_id = request.POST.get('artist') or selected_artist_id
        selected_member_ids = list(map(int, request.POST.getlist('members')))
        image_files = request.FILES.getlist('images')

        form = form_class(request.POST, request.FILES)
        formset = SplitPriceFormSet(request.POST, prefix='splitprice') if category == 'split' else None

        # ✅ 디버깅: formset errors 출력
        if category == 'split' and formset:
            if form.is_valid() and (formset.is_valid() if formset else True):
                if not image_files:
                    form.add_error(None, "이미지는 최소 1장 이상 업로드해야 합니다.")
                else:
                    post = form.save(commit=False)
                    post.user = request.user
                    if selected_artist_id:
                        post.artist_id = selected_artist_id
                    post.save()

                    # ✅ split 카테고리에서는 formset에서 멤버 추출
                    if category == 'split' and formset:
                        split_prices = formset.save(commit=False)
                    
                        member_ids = [sp.member_id for sp in split_prices]
                        post.members.set(member_ids)
                        for sp in split_prices:
                            sp.post = post
                            sp.save()
                    else:
                        # ✅ sell/rental 카테고리는 선택된 멤버 IDs 그대로 사용
                        post.members.set(selected_member_ids)

                    form.save_m2m()

                    # ✅ 이미지 저장
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

    # ✅ split: 멤버 및 폼셋 준비
    default_artist_id = int(selected_artist_id) if selected_artist_id else (
        favorite_artists[0].id if favorite_artists.exists() else None
    )

    selected_members = []
    formset = None
    formset_with_names = None
    member_names = []

    if category == 'split' and default_artist_id:
        selected_members = Member.objects.filter(artist_name__id=default_artist_id).distinct()
        initial_data = [{'member': m.id} for m in selected_members]
        formset = SplitPriceFormSet(queryset=SplitPrice.objects.none(), initial=initial_data, prefix='splitprice')
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


@login_required
def load_split_members_and_prices(request):
    artist_id = request.GET.get('artist_id')
    if not artist_id:
        return JsonResponse({'error': '아티스트 ID가 필요합니다.'}, status=400)

    # 멤버 전체 불러오기
    members = Member.objects.filter(artist_name__id=artist_id).distinct()
    initial_data = [{'member': m.id} for m in members]

    # formset을 멤버 수만큼 정확히 생성
    class SplitPriceForm(Form):
        member = IntegerField(widget=HiddenInput())
        price = DecimalField(
            max_digits=10,
            decimal_places=2,
            widget=NumberInput(attrs={
                'class': 'w-full px-3 py-2 border border-gray-300 rounded',
                'placeholder': '가격을 입력하세요',
            })
        )

    SplitPriceFormSet = formset_factory(SplitPriceForm, extra=0, can_delete=False)
    formset = SplitPriceFormSet(initial=initial_data, prefix='splitprice')

    member_names = [m.member_name for m in members]
    formset_with_names = zip(formset, member_names)

    formset_html = render_to_string(
        'ddokfarm/components/post_form/_splitprice_formset.html',
        {'formset': formset, 'formset_with_names': formset_with_names},
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
        form = form_class(request.POST, request.FILES, instance=post)
        image_files = request.FILES.getlist('images')  # 새 이미지 받기
        removed_ids = request.POST.get('removed_image_ids', '').split(',')
        removed_ids = [int(id) for id in removed_ids if id.isdigit()]  # 삭제할 ID만 정수로 처리

        if form.is_valid():
            post = form.save(commit=False)
            artist_id = request.POST.get('artist')
            member_ids = request.POST.getlist('members')

            if artist_id:
                post.artist_id = artist_id

            post.save()
            post.members.set(member_ids)

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

            return redirect('ddokfarm:post_detail', category=category, post_id=post.id)

    else:
        form = form_class(instance=post)

    existing_images = []
    for img in post.images.all():
        existing_images.append({
            "id": img.id,
            "url": img.image.url if img.image else f"{settings.MEDIA_URL}default.jpg"
        })

    sorted_artists = Artist.objects.order_by('display_name')
    selected_members = Member.objects.filter(artist_name=post.artist).distinct()
    selected_member_ids = list(post.members.values_list('id', flat=True))
    selected_artist_id = post.artist.id if post.artist else None

    context = {
        'form': form,
        'post': post,
        'category': category,
        'sorted_artists': sorted_artists,
        'selected_members': selected_members,
        'selected_member_ids': selected_member_ids,
        'selected_artist_id': selected_artist_id,
        'submit_label': '수정 완료',
        'cancel_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        'mode': 'edit',
        'categories': get_ddokfarm_categories(),
        **get_ajax_base_context(request),
        'existing_images': existing_images,
    }

    return render(request, 'ddokfarm/edit.html', context)

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
                "components/post_detail/_comment_item.html",
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

    comment.delete()

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
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    # 작성자 권한 확인
    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '판매 완료 처리를 할 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    # 판매 상태 토글
    post.is_sold = not post.is_sold
    post.save()

    return redirect('ddokfarm:post_detail', category=category, post_id=post.id)

# 아티스트 선택시 멤버 목록 출력
def get_members_by_artist(request, artist_id):
    members = Member.objects.filter(artist_name__id=artist_id).distinct()
    member_data = [
        {"id": member.id, "name": member.member_name}
        for member in members
    ]
    
    return JsonResponse({"members": member_data})