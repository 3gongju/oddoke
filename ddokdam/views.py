from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.db.models import Count
from django.http import JsonResponse

from .models import DdokdamPost, DdokdamComment
from .forms import DdokdamCommentForm, CommunityPostForm, FoodPostForm, CafePostForm


def index(request):
    sort = request.GET.get('sort', 'latest')
    posts = DdokdamPost.objects.all()

    if sort == 'likes':
        posts = posts.annotate(num_likes=Count('like_users')).order_by('-num_likes')
    elif sort == 'comments':
        posts = posts.annotate(num_comments=Count('ddokdamcomment')).order_by('-num_comments')
    else:
        posts = posts.order_by('-created_at')

    context = {
        'posts': posts,
        'category': '',
        'category_name': '전체',
        'current_sort': sort,
    }
    return render(request, 'ddokdam/category_list.html', context)


@login_required
def create(request):
    if request.method == 'POST':
        category = request.POST.get('category')
        form = None

        if category == 'community':
            form = CommunityPostForm(request.POST, request.FILES)
        elif category == 'food':
            form = FoodPostForm(request.POST, request.FILES)
        elif category == 'cafe':
            form = CafePostForm(request.POST, request.FILES)

        if form and form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.category = category
            post.save()
            return redirect('ddokdam:detail', post_id=post.id)

        # ✅ 유효성 검사 실패 시 에러 확인을 위해 출력
        print("폼 오류:", form.errors)

        return render(request, 'ddokdam/create.html', {
            'community_form': form if category == 'community' else CommunityPostForm(),
            'food_form': form if category == 'food' else FoodPostForm(),
            'cafe_form': form if category == 'cafe' else CafePostForm(),
        })

    return render(request, 'ddokdam/create.html', {
        'community_form': CommunityPostForm(),
        'food_form': FoodPostForm(),
        'cafe_form': CafePostForm(),
    })


def detail(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)
    comments = DdokdamComment.objects.filter(post=post).select_related('user').prefetch_related('replies')
    comment_form = DdokdamCommentForm()

    return render(request, 'ddokdam/detail.html', {
        'post': post,
        'comments': comments,
        'comment_form': comment_form,
    })


def category_list(request, category):
    posts = DdokdamPost.objects.filter(category=category)
    sort = request.GET.get('sort', 'latest')

    if sort == 'likes':
        posts = posts.annotate(num_likes=Count('like_users')).order_by('-num_likes')
    elif sort == 'comments':
        posts = posts.annotate(num_comments=Count('ddokdamcomment')).order_by('-num_comments')
    else:
        posts = posts.order_by('-created_at')

    category_name = dict(DdokdamPost.CATEGORY_CHOICES).get(category, '알 수 없음')

    return render(request, 'ddokdam/category_list.html', {
        'posts': posts,
        'category': category,
        'category_name': category_name,
        'current_sort': sort,
    })


@login_required
def update(request, post_id):
    post = get_object_or_404(DdokdamPost, pk=post_id)

    if request.method == "POST":
        post.title = request.POST.get("title")
        post.content = request.POST.get("content")
        if request.FILES.get("image"):
            post.image = request.FILES["image"]

        if post.category == "community" or post.category == "cafe":
            post.idol = request.POST.get("idol")
        if post.category == "food":
            post.location = request.POST.get("location")

        if post.category == "cafe":
            post.cafe_name = request.POST.get("cafe_name")
            post.cafe_location = request.POST.get("cafe_location")
            post.start_date = request.POST.get("start_date") or None
            post.end_date = request.POST.get("end_date") or None

        post.save()
        return redirect("ddokdam:detail", post_id=post.id)

    return render(request, "ddokdam/update.html", {
        "post": post,
        "form": CommunityPostForm(instance=post),  # 임시 폼
        "idol_list": ["bts", "blackpink", "twice", "exo", "itzy", "seventeen", "nct", "ive", "aespa", "newjeans"],
    })


@login_required
def delete(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)
    if request.user != post.user:
        return redirect('ddokdam:detail', post_id=post_id)
    post.delete()
    return redirect('ddokdam:index')


@login_required
@require_POST
def comment_create(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)
    form = DdokdamCommentForm(request.POST)

    if form.is_valid():
        comment = form.save(commit=False)
        comment.user = request.user
        comment.post = post
        comment.save()
        return redirect('ddokdam:detail', post_id=post_id)

    return redirect('ddokdam:detail', post_id=post_id)


@login_required
def comment_delete(request, post_id, comment_id):
    comment = get_object_or_404(DdokdamComment, id=comment_id, post_id=post_id)
    if request.user != comment.user:
        return redirect('ddokdam:detail', post_id=post_id)
    comment.delete()
    return redirect('ddokdam:detail', post_id=post_id)


@login_required
def like(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)
    if request.user in post.like_users.all():
        post.like_users.remove(request.user)
        liked = False
    else:
        post.like_users.add(request.user)
        liked = True
    return JsonResponse({'liked': liked, 'like_count': post.like_users.count()})
