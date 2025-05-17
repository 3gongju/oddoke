from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import DdokdamPost, DdokdamComment
from .forms import DdokdamPostForm, DdokdamCommentForm

def index(request):
    community_posts = DdokdamPost.objects.filter(category='community').order_by('-created_at')[:2]
    food_posts = DdokdamPost.objects.filter(category='food').order_by('-created_at')[:2]
    cafe_posts = DdokdamPost.objects.filter(category='cafe').order_by('-created_at')[:2]

    context = {
        'community_posts': community_posts,
        'food_posts': food_posts,
        'cafe_posts': cafe_posts,
    }
    return render(request, 'ddokdam/index.html', context)

@login_required
def create(request):
    if request.method == 'POST':
        form = DdokdamPostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.save()
            return redirect('ddokdam:index')
    else:
        form = DdokdamPostForm()

    return render(request, 'create.html', {'form': form})


def detail(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)
    comments = DdokdamComment.objects.filter(post=post).order_by('-created_at')
    comment_form = DdokdamCommentForm()

    return render(request, 'detail.html', {
        'post': post,
        'comments': comments,
        'comment_form': comment_form,
    })
    
def category_list(request, category):
    posts = DdokdamPost.objects.filter(category=category).order_by('-created_at')

    sort = request.GET.get('sort', 'latest')
    if sort == 'likes':
        posts = posts.order_by('-created_at')  # 향후 좋아요 수로 수정 가능
    elif sort == 'comments':
        posts = posts.order_by('-created_at')  # 향후 댓글 수로 수정 가능

    category_name = dict(DdokdamPost.CATEGORY_CHOICES).get(category, '알 수 없음')

    context = {
        'posts': posts,
        'category': category,
        'category_name': category_name,
        'current_sort': sort,
    }
    return render(request, 'ddokdam/category_list.html', context)

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
    return render(request, 'ddokdam/update.html', context)

@login_required
def delete(request, post_id):
    post = get_object_or_404(DdokdamPost, id=post_id)

    if request.user != post.user:
        return redirect('ddokdam:detail', post_id=post_id)

    post.delete()
    return redirect('ddokdam:index')

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