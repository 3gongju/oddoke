from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from .forms import PostForm, CommentForm
from .models import Post, Comment, Category



# ✅ 홈 화면 (루트 URL)
def main(request):
    return render(request, 'main/home.html')


# ✅ 게시글 목록 (카테고리, 정렬 포함)
def index(request):
    posts = Post.objects.all().order_by('-created_at')

    category_slug = request.GET.get('category')
    current_category = None

    if category_slug:
        category = Category.objects.filter(slug=category_slug).first()
        if category:
            posts = posts.filter(category=category)
            current_category = category.slug

    # 정렬 조건
    sort = request.GET.get('sort', 'latest')
    if sort == 'price_low':
        posts = posts.order_by('price')
    elif sort == 'price_high':
        posts = posts.order_by('-price')
    else:
        posts = posts.order_by('-created_at')

    categories = Category.objects.all()

    context = {
        'posts': posts,
        'categories': Category.objects.all(),
        'current_category': current_category,
        'current_sort': sort,
    }

    return render(request, 'ddokfarm/index.html', context)


# ✅ 게시글 작성
@login_required
def create(request):
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.save()
            return redirect('ddokfarm:detail', post_id=post.id)
    else:
        form = PostForm()

    categories = Category.objects.all()
    return render(request, 'ddokfarm/create.html', {'form': form, 'categories': categories})


# ✅ 게시글 상세 보기
def detail(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    comments = Comment.objects.filter(post=post).select_related('user').prefetch_related('replies')

    form = CommentForm()
    context = {
        'post': post,
        'comments': comments,
        'form': form,
    }
    return render(request, 'ddokfarm/detail.html', context)

# ✅ 게시글 수정
@login_required
def update(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    if request.user != post.user:
        return redirect('ddokfarm:detail', post_id=post.id)

    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            form.save()
            return redirect('ddokfarm:detail', post_id=post.id)
    else:
        form = PostForm(instance=post)

    categories = Category.objects.all()
    context = {
        'form': form,
        'post': post,
        'categories': categories,
    }
    return render(request, 'ddokfarm/update.html', context)


# ✅ 게시글 삭제
@login_required
@require_POST
def delete(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    if request.user != post.user:
        return redirect('ddokfarm:detail', post_id=post.id)

    post.delete()
    return redirect('ddokfarm:index')

# 찜하기 추가 
@require_POST
@login_required
def toggle_like(request, post_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': '로그인 필요'}, status=403)

    post = get_object_or_404(Post, id=post_id)
    user = request.user

    if user in post.liked_users.all():
        post.liked_users.remove(user)
        liked = False
    else:
        post.liked_users.add(user)
        liked = True

    return JsonResponse({'liked': liked, 'likes_count': post.liked_users.count()})

# 판매 완료 표시시
@require_POST
@login_required
def mark_as_sold(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    if request.user != post.user:
        return redirect('ddokfarm:detail', post_id=post.id)

    post.is_sold = not post.is_sold
    post.save()
    return redirect('ddokfarm:detail', post_id=post.id)

# ✅ 댓글 생성
@require_POST
@login_required
def comment_create(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    form = CommentForm(request.POST)

    if form.is_valid():
        comment = form.save(commit=False)
        comment.user = request.user
        comment.post = post
        comment.save()
        return redirect('ddokfarm:detail', post_id=post_id)

    return redirect('ddokfarm:detail', post_id=post_id)



# ✅ 댓글 삭제
@login_required
@require_POST
def comment_delete(request, post_id, id):
    comment = get_object_or_404(Comment, id=id)

    if request.user != comment.user:
        return redirect('ddokfarm:detail', post_id=post_id)

    comment.delete()
    return redirect('ddokfarm:detail', post_id=post_id)
