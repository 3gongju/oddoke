from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponseForbidden, HttpResponseNotAllowed
from django.views.decorators.http import require_POST, require_GET
from django.http import JsonResponse
from django.urls import reverse
from django.db.models import Q
from operator import attrgetter
from .models import DamComment
from .forms import DamCommentForm
from .utils import get_post_model, get_post_form, get_post_comments, get_post_queryset, assign_post_to_comment, get_comment_post_field_and_id
from artist.models import Member, Artist

# 전체 게시글 보기
def index(request):
    category = request.GET.get('category')
    posts = get_post_queryset(category)
    posts = sorted(posts, key=attrgetter('created_at'), reverse=True)

    context = {
        'posts': posts,
        'category': category,
    }
    return render(request, 'ddokdam/index.html', context)

# 커뮤니티 게시글 보기
def community_index(request):
    return redirect('/ddokdam/?category=community')

# 덕매너 게시글 보기
def manner_index(request):
    return redirect('/ddokdam/?category=manner')

# 생카 게시글 보기
def bdaycafe_index(request):
    return redirect('/ddokdam/?category=bdaycafe')

# 게시글 상세보기
def post_detail(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    comments = get_post_comments(category, post).filter(parent__isnull=True).select_related('user').prefetch_related('replies__user')

    total_comment_count = get_post_comments(category, post).count()

    comment_form = DamCommentForm()

    is_liked = request.user.is_authenticated and post.like.filter(id=request.user.id).exists()

    context = {
        'post': post,
        'category': category,
        'comments': comments,
        'total_comment_count': total_comment_count,
        'comment_form': comment_form,
        'is_liked': is_liked,
        'artist': post.artist,
        'members': post.members.all(),
    }

    return render(request, 'ddokdam/post_detail_test.html', context)


# 게시글 작성
@login_required
def post_create(request):
    favorite_artists = Artist.objects.filter(followers=request.user)

    if request.method == 'POST':
        category = request.POST.get('category')
        selected_artist_id = request.POST.get('artist')
        selected_member_ids = list(map(int, request.POST.getlist('members')))

        form_class = get_post_form(category)
        if not form_class:
            raise Http404("존재하지 않는 카테고리입니다.")

        form = form_class(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.save()
            form.save_m2m()
            return redirect('ddokdam:post_detail', category=category, post_id=post.id)
    else:
        # GET 요청 시 기본 카테고리 선택
        category = request.GET.get('category') or 'community'
        selected_artist_id = None
        selected_member_ids = []
        form_class = get_post_form(category)

        if not form_class:
            raise Http404("존재하지 않는 카테고리입니다.")
        form = form_class()

    # 아티스트 정렬 (팔로우한 아티스트 우선)
    all_artists = Artist.objects.all()
    sorted_artists = list(favorite_artists) + list(all_artists.exclude(id__in=favorite_artists))
    default_artist_id = int(selected_artist_id) if selected_artist_id else (
        favorite_artists.first().id if favorite_artists.exists() else None
    )

    # 선택된 아티스트의 멤버 목록
    selected_members = []
    if default_artist_id:
        selected_members = Member.objects.filter(artist_name__id=default_artist_id).distinct()

    context = {
        'form': form,
        'category': category,
        'sorted_artists': sorted_artists,
        'default_artist_id': default_artist_id,
        'selected_members': selected_members,
        'selected_member_ids': selected_member_ids,
    }

    return render(request, 'ddokdam/post_create.html', context)    

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
            'back_url': reverse('ddokdam:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokdam/error_message.html', context)

    if request.method == 'POST':
        form = form_class(request.POST, request.FILES, instance=post)
        if form.is_valid():
            post = form.save(commit=False)

            artist_id = request.POST.get('artist')
            member_ids = request.POST.getlist('members')

            if artist_id:
                post.artist_id = artist_id

            post.save()

            post.members.set(member_ids)

            return redirect('ddokdam:post_detail', category=category, post_id=post.id)
    else:
        form = form_class(instance=post)

    # GET/POST 공통 context 설정
    sorted_artists = Artist.objects.order_by('display_name')
    selected_members = Member.objects.filter(artist_name=post.artist).distinct()
    selected_member_ids = list(post.members.values_list('id', flat=True))

    context = {
        'form': form,
        'post': post,
        'category': category,
        'sorted_artists': sorted_artists,
        'selected_members': selected_members,
        'selected_member_ids': selected_member_ids,
    }
    return render(request, 'ddokdam/post_edit.html', context)

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
            'back_url': reverse('ddokdam:post_detail', args=[category, post.id]),
        }

        return render(request, 'ddokdam/error_message.html', context)

    if request.method == 'POST':
        post.delete()
        return redirect(f"{reverse('ddokdam:index')}?category={category}")

    context = {
    'title': '잘못된 접근입니다',
    'message': '게시글 삭제는 버튼을 통해서만 가능합니다.',
    'back_url': reverse('ddokdam:post_detail', args=[category, post.id])
    }

    # 🚨 GET 요청이 들어오면 친절한 안내 페이지 보여주기
    return render(request, 'ddokdam/error_message.html', context)


# 댓글 작성
@login_required
@require_POST
def comment_create(request, category, post_id):
    post_model = get_post_model(category)
    post = get_object_or_404(post_model, id=post_id)

    form = DamCommentForm(request.POST)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.user = request.user

        # 연결된 게시글 설정
        assign_post_to_comment(comment, category, post)

        # 대댓글이면 부모 댓글 설정
        parent_id = request.POST.get("parent")
        if parent_id:
            comment.parent = get_object_or_404(DamComment, id=parent_id)

        comment.save()

    return redirect('ddokdam:post_detail', category=category, post_id=post_id)

# 댓글 삭제
@login_required
def comment_delete(request, category, post_id, comment_id):
    comment = get_object_or_404(DamComment, id=comment_id)

    # utils.py로 분리된 확인 로직 사용
    try:
        _, _ = get_comment_post_field_and_id(comment, category, post_id)
    except Http404:
        raise

    if request.user != comment.user:
        return HttpResponseForbidden()

    comment.delete()
    return redirect('ddokdam:post_detail', category=category, post_id=post_id)

# 좋아요
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

# 아티스트 선택시 멤버 목록 출력
def get_members_by_artist(request, artist_id):
    members = Member.objects.filter(artist_name__id=artist_id).distinct()
    member_data = [
        {"id": member.id, "name": member.member_name}
        for member in members
    ]
    return JsonResponse({"members": member_data})

# def index(request):
#     sort = request.GET.get('sort', 'latest')
#     posts = DdokdamPost.objects.all()

#     if sort == 'likes':
#         posts = posts.annotate(num_likes=Count('like_users')).order_by('-num_likes')
#     elif sort == 'comments':
#         posts = posts.annotate(num_comments=Count('ddokdamcomment')).order_by('-num_comments')
#     else:
#         posts = posts.order_by('-created_at')

#     context = {
#         'posts': posts,
#         'category': '',
#         'category_name': '전체',
#         'current_sort': sort,
#     }
#     return render(request, 'ddokdam/category_list.html', context)


# @login_required
# def create(request):
#     if request.method == 'POST':
#         category = request.POST.get('category')
#         form = None

#         if category == 'community':
#             form = CommunityPostForm(request.POST, request.FILES)
#         elif category == 'food':
#             form = FoodPostForm(request.POST, request.FILES)
#         elif category == 'cafe':
#             form = CafePostForm(request.POST, request.FILES)

#         if form and form.is_valid():
#             post = form.save(commit=False)
#             post.user = request.user
#             post.category = category
#             post.save()
#             return redirect('ddokdam:detail', post_id=post.id)

#         # ✅ 유효성 검사 실패 시 에러 확인을 위해 출력
#         print("폼 오류:", form.errors)

#         return render(request, 'ddokdam/create.html', {
#             'community_form': form if category == 'community' else CommunityPostForm(),
#             'food_form': form if category == 'food' else FoodPostForm(),
#             'cafe_form': form if category == 'cafe' else CafePostForm(),
#         })

#     return render(request, 'ddokdam/create.html', {
#         'community_form': CommunityPostForm(),
#         'food_form': FoodPostForm(),
#         'cafe_form': CafePostForm(),
#     })


# def category_list(request, category):
#     posts = DdokdamPost.objects.filter(category=category)
#     sort = request.GET.get('sort', 'latest')

#     if sort == 'likes':
#         posts = posts.annotate(num_likes=Count('like_users')).order_by('-num_likes')
#     elif sort == 'comments':
#         posts = posts.annotate(num_comments=Count('ddokdamcomment')).order_by('-num_comments')
#     else:
#         posts = posts.order_by('-created_at')

#     category_name = dict(DdokdamPost.CATEGORY_CHOICES).get(category, '알 수 없음')

#     return render(request, 'ddokdam/category_list.html', {
#         'posts': posts,
#         'category': category,
#         'category_name': category_name,
#         'current_sort': sort,
#     })


# @login_required
# def update(request, post_id):
#     post = get_object_or_404(DdokdamPost, pk=post_id)

#     if request.method == "POST":
#         post.title = request.POST.get("title")
#         post.content = request.POST.get("content")
#         if request.FILES.get("image"):
#             post.image = request.FILES["image"]

#         if post.category == "community" or post.category == "cafe":
#             post.idol = request.POST.get("idol")
#         if post.category == "food":
#             post.location = request.POST.get("location")

#         if post.category == "cafe":
#             post.cafe_name = request.POST.get("cafe_name")
#             post.cafe_location = request.POST.get("cafe_location")
#             post.start_date = request.POST.get("start_date") or None
#             post.end_date = request.POST.get("end_date") or None

#         post.save()
#         return redirect("ddokdam:detail", post_id=post.id)

#     return render(request, "ddokdam/update.html", {
#         "post": post,
#         "form": CommunityPostForm(instance=post),  # 임시 폼
#         "idol_list": ["bts", "blackpink", "twice", "exo", "itzy", "seventeen", "nct", "ive", "aespa", "newjeans"],
#     })


# @login_required
# def delete(request, post_id):
#     post = get_object_or_404(DdokdamPost, id=post_id)
#     if request.user != post.user:
#         return redirect('ddokdam:detail', post_id=post_id)
#     post.delete()
#     return redirect('ddokdam:index')


# @login_required
# @require_POST
# def comment_create(request, post_id):
#     post = get_object_or_404(DdokdamPost, id=post_id)
#     form = DdokdamCommentForm(request.POST)

#     if form.is_valid():
#         comment = form.save(commit=False)
#         comment.user = request.user
#         comment.post = post
#         comment.save()
#         return redirect('ddokdam:detail', post_id=post_id)

#     return redirect('ddokdam:detail', post_id=post_id)


# @login_required
# def comment_delete(request, post_id, comment_id):
#     comment = get_object_or_404(DdokdamComment, id=comment_id, post_id=post_id)
#     if request.user != comment.user:
#         return redirect('ddokdam:detail', post_id=post_id)
#     comment.delete()
#     return redirect('ddokdam:detail', post_id=post_id)


# @login_required
# def like(request, post_id):
#     post = get_object_or_404(DdokdamPost, id=post_id)
#     if request.user in post.like_users.all():
#         post.like_users.remove(request.user)
#         liked = False
#     else:
#         post.like_users.add(request.user)
#         liked = True
#     return JsonResponse({'liked': liked, 'like_count': post.like_users.count()})
