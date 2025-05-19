from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.http import JsonResponse

from .models import DdokdamPost, DdokdamComment
from .forms import DdokdamPostForm, DdokdamCommentForm


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
        form = DdokdamPostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.save()

            hashtags = request.POST.getlist('hashtags')
            if hashtags:
                post.idol = ','.join(hashtags)
                post.save()

            return redirect('ddokdam:detail', post_id=post.id)
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
    posts = DdokdamPost.objects.filter(category=category)
    sort = request.GET.get('sort', 'latest')

    if sort == 'likes':
        posts = posts.annotate(num_likes=Count('like_users')).order_by('-num_likes')
    elif sort == 'comments':
        posts = posts.annotate(num_comments=Count('ddokdamcomment')).order_by('-num_comments')
    else:
        posts = posts.order_by('-created_at')

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

    return render(request, 'update.html', {'form': form, 'post': post})

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
            comment.user = request.user
            comment.post = post
            comment.save()

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
