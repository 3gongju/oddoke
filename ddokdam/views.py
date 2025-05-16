from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import DdokdamPost, DdokdamComment
from .forms import DdokdamPostForm, DdokdamCommentForm

def index(request):
    community_posts = DdokdamPost.objects.filter(category='community').order_by('-created_at')[:5]
    food_posts = DdokdamPost.objects.filter(category='food').order_by('-created_at')[:5]
    cafe_posts = DdokdamPost.objects.filter(category='cafe').order_by('-created_at')[:5]

    context = {
        'community_posts': community_posts,
        'food_posts': food_posts,
        'cafe_posts': cafe_posts,
    }
    return render(request, 'ddokdam_index.html', context)

def category_list(request, category):
    posts = DdokdamPost.objects.filter(category=category).order_by('-created_at')

    sort = request.GET.get('sort', 'latest')
    if sort == 'likes':
        posts = posts.order_by('-created_at')  # 추후 좋아요 수 기준으로 변경 가능
    elif sort == 'comments':
        posts = posts.order_by('-created_at')  # 추후 댓글 수 기준으로 변경 가능

    category_name = dict(DdokdamPost.CATEGORY_CHOICES)[category]

    context = {
        'posts': posts,
        'category': category,
        'category_name': category_name,
        'current_sort': sort,
    }
    return render(request, 'category_list.html', context)

@login_required
def create(request):
    if request.method == 'POST':
        form = DdokdamPostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user

            # ✅ category가 없으면 기본값 설정
            if not post.category:
                post.category = 'community'

            post.save()
            return redirect('ddokdam:category_list', category=post.category)
        else:
            print("❗️폼 오류:", form.errors)
    else:
        form = DdokdamPostForm()

    context = {
        'form': form,
    }
    return render(request, 'create.html', context)

def detail(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)
    comments = DdokdamComment.objects.filter(post=post).order_by('-created_at')
    comment_form = DdokdamCommentForm()

    context = {
        'post': post,
        'comments': comments,
        'comment_form': comment_form,
    }
    return render(request, 'detail.html', context)

@login_required
def comment_create(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)

    if request.method == 'POST':
        form = DdokdamCommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.post = post
            comment.user = request.user
            comment.save()
    return redirect('ddokdam:detail', post_id=post_id)

@login_required
def update(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)

    if request.user != post.user:
        return redirect('ddokdam:detail', post_id=post_id)

    if request.method == 'POST':
        form = DdokdamPostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            form.save()
            return redirect('ddokdam:detail', post_id=post_id)
    else:
        form = DdokdamPostForm(instance=post)

    context = {
        'form': form,
        'post': post,
    }
    return render(request, 'update.html', context)

@login_required
def delete(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)

    if request.user != post.user:
        return redirect('ddokdam:detail', post_id=post_id)

    post.delete()
    return redirect('ddokdam:index')