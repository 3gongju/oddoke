from django.shortcuts import render, redirect, get_object_or_404
from .forms import PostForm, CommentForm
from .models import Post, Comment, Category
from django.contrib.auth.decorators import login_required

def main(request):
    """홈페이지를 렌더링합니다."""
    return render(request, 'main/home.html')

@login_required
def create(request):
    """새 게시물을 생성합니다."""
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.save()
            return redirect('ddokfarm:index')
    else:
        form = PostForm()
    
    # 카테고리 목록을 컨텍스트에 추가
    categories = Category.objects.all()
    
    context = {
        'form': form,
        'categories': categories,
    }

    return render(request, 'create.html', context)

def index(request):
    """게시물 목록을 보여줍니다."""
    posts = Post.objects.all().order_by('-created_at')
    
    # 카테고리 필터링 처리
    category_id = request.GET.get('category')
    if category_id:
        posts = posts.filter(category_id=category_id)
    
    # 정렬 처리
    sort = request.GET.get('sort', 'latest')  # 기본값은 최신순
    if sort == 'price_low':
        posts = posts.order_by('price')
    elif sort == 'price_high':
        posts = posts.order_by('-price')
    elif sort == 'latest':
        posts = posts.order_by('-created_at')  # 기본값, 명시적으로 설정
    
    # 카테고리 목록 가져오기
    categories = Category.objects.all()
    
    context = {
        'posts': posts,
        'categories': categories,
        'current_category': category_id,
        'current_sort': sort,
    }

    return render(request, 'index.html', context)

@login_required
def update(request, id):
    """게시물을 수정합니다."""
    post = get_object_or_404(Post, id=id)
    
    # 본인 게시물만 수정 가능하도록 확인
    if request.user != post.user:
        return redirect('ddokfarm:detail', id=id)
    
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            form.save()
            return redirect('ddokfarm:detail', id=id)
    else:
        form = PostForm(instance=post)
    
    # 카테고리 목록을 컨텍스트에 추가
    categories = Category.objects.all()
    
    context = {
        'form': form,
        'post': post,
        'categories': categories,
    }

    return render(request, 'update.html', context)

@login_required
def delete(request, id):
    """게시물을 삭제합니다."""
    post = get_object_or_404(Post, id=id)
    
    # 본인 게시물만 삭제 가능하도록 확인
    if request.user != post.user:
        return redirect('ddokfarm:detail', id=id)
    
    try:
        post.delete()
        return redirect('ddokfarm:index')
    except Exception as e:
        print(f"삭제 오류: {e}")
        return redirect('ddokfarm:detail', id=id)

def detail(request, id):
    """게시물 상세 내용을 보여줍니다."""
    post = get_object_or_404(Post, id=id)
    comments = post.comment_set.all()  # 해당 게시물에 연결된 모든 댓글 가져오기
    form = CommentForm()

    context = {
        'post': post,
        'comments': comments,
        'form': form,
    }

    return render(request, 'detail.html', context)

@login_required
def comment_create(request, post_id):
    """댓글을 생성합니다."""
    post = get_object_or_404(Post, id=post_id)
    form = CommentForm(request.POST)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.user = request.user
        comment.post = post
        comment.save()

        return redirect('ddokfarm:detail', id=post_id)
    
    # 폼이 유효하지 않을 경우, 다시 상세 페이지로
    return redirect('ddokfarm:detail', id=post_id)

@login_required
def comment_delete(request, post_id, id):
    """댓글을 삭제합니다."""
    comment = get_object_or_404(Comment, id=id)
    
    # 본인 댓글만 삭제 가능하도록 확인
    if request.user != comment.user:
        return redirect('ddokfarm:detail', id=post_id)
    
    comment.delete()
    return redirect('ddokfarm:detail', id=post_id)

@login_required
def mark_as_sold(request, id):
    """게시물을 판매완료로 표시합니다."""
    post = get_object_or_404(Post, id=id)
    
    # 본인 게시물만 판매완료 처리 가능
    if request.user != post.user:
        return redirect('ddokfarm:detail', id=id)
    
    # 판매 상태 토글 (판매중 ↔ 판매완료)
    post.is_sold = not post.is_sold
    post.save()
    
    return redirect('ddokfarm:detail', id=id)