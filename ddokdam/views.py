from django.shortcuts import render, redirect, get_object_or_404
from .forms import CommunityPostForm, FoodPostForm, CafePostForm, CommentForm
from .models import Post, Comment
from django.contrib.auth.decorators import login_required

def index(request):
    # 카테고리별 필터링
    category = request.GET.get('category', '')
    
    if category and category in ['community', 'food', 'cafe']:
        posts = Post.objects.filter(category=category).order_by('-created_at')
    else:
        posts = Post.objects.all().order_by('-created_at')
    
    context = {
        'posts': posts,
        'current_category': category,
    }
    return render(request, 'index.html', context)

@login_required
def create(request):
    """게시물 생성 뷰 - 카테고리별 다른 폼 처리"""
    if request.method == 'POST':
        # POST 요청에서 카테고리 가져오기
        category = request.POST.get('category', 'community')
        
        # 카테고리별 적절한 폼 선택
        if category == 'community':
            form = CommunityPostForm(request.POST, request.FILES)
        elif category == 'food':
            form = FoodPostForm(request.POST, request.FILES)
        elif category == 'cafe':
            form = CafePostForm(request.POST, request.FILES)
        else:
            # 기본값은 커뮤니티 폼
            form = CommunityPostForm(request.POST, request.FILES)
        
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.category = category
            
            # 카테고리별 추가 필드 처리
            if category == 'community':
                post.idol = form.cleaned_data.get('idol', '')
            elif category == 'food':
                post.location = form.cleaned_data.get('location', '')
                post.doll = form.cleaned_data.get('doll', '')
            elif category == 'cafe':
                post.idol = form.cleaned_data.get('idol', '')
                post.cafe_name = form.cleaned_data.get('cafe_name', '')
                post.cafe_location = form.cleaned_data.get('cafe_location', '')
                post.start_date = form.cleaned_data.get('start_date')
                post.end_date = form.cleaned_data.get('end_date')
            
            post.save()
            return redirect('ddokdam:index')
    else:
        # GET 요청일 경우 빈 폼 제공 (템플릿에서 처리)
        pass
    
    return render(request, 'create.html')

def detail(request, id):
    """게시물 상세 보기"""
    post = get_object_or_404(Post, id=id)
    comments = post.comment_set.all().order_by('-created_at')
    comment_form = CommentForm()
    
    context = {
        'post': post,
        'comments': comments,
        'comment_form': comment_form,
    }
    return render(request, 'detail.html', context)

@login_required
def update(request, id):
    """게시물 수정"""
    post = get_object_or_404(Post, id=id)
    
    # 본인 게시물만 수정 가능
    if request.user != post.user:
        return redirect('ddokdam:detail', id=id)
    
    if request.method == 'POST':
        # 카테고리별 적절한 폼 선택
        category = post.category
        
        if category == 'community':
            form = CommunityPostForm(request.POST, request.FILES, instance=post)
        elif category == 'food':
            form = FoodPostForm(request.POST, request.FILES, instance=post)
        elif category == 'cafe':
            form = CafePostForm(request.POST, request.FILES, instance=post)
        
        if form.is_valid():
            post = form.save(commit=False)
            
            # 카테고리별 추가 필드 업데이트
            if category == 'community':
                post.idol = form.cleaned_data.get('idol', '')
            elif category == 'food':
                post.location = form.cleaned_data.get('location', '')
                post.doll = form.cleaned_data.get('doll', '')
            elif category == 'cafe':
                post.idol = form.cleaned_data.get('idol', '')
                post.cafe_name = form.cleaned_data.get('cafe_name', '')
                post.cafe_location = form.cleaned_data.get('cafe_location', '')
                post.start_date = form.cleaned_data.get('start_date')
                post.end_date = form.cleaned_data.get('end_date')
            
            post.save()
            return redirect('ddokdam:detail', id=id)
    else:
        # 기존 데이터로 폼 초기화
        category = post.category
        
        if category == 'community':
            form = CommunityPostForm(instance=post, initial={'idol': post.idol})
        elif category == 'food':
            form = FoodPostForm(instance=post, initial={
                'location': post.location,
                'doll': post.doll
            })
        elif category == 'cafe':
            form = CafePostForm(instance=post, initial={
                'idol': post.idol,
                'cafe_name': post.cafe_name,
                'cafe_location': post.cafe_location,
                'start_date': post.start_date,
                'end_date': post.end_date
            })
    
    context = {
        'post': post,
        'form': form,
    }
    return render(request, 'update.html', context)

@login_required
def delete(request, id):
    """게시물 삭제"""
    post = get_object_or_404(Post, id=id)
    
    # 본인 게시물만 삭제 가능
    if request.user != post.user:
        return redirect('ddokdam:detail', id=id)
    
    post.delete()
    return redirect('ddokdam:index')

@login_required
def comment_create(request, post_id):
    """댓글 생성"""
    post = get_object_or_404(Post, id=post_id)
    
    if request.method == 'POST':
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.user = request.user
            comment.post = post
            comment.save()
    
    return redirect('ddokdam:detail', id=post_id)

@login_required
def comment_delete(request, post_id, comment_id):
    """댓글 삭제"""
    comment = get_object_or_404(Comment, id=comment_id)
    
    # 본인 댓글만 삭제 가능
    if request.user != comment.user:
        return redirect('ddokdam:detail', id=post_id)
    
    comment.delete()
    return redirect('ddokdam:detail', id=post_id)

@login_required
def like(request, post_id):
    """게시물 좋아요 토글"""
    post = get_object_or_404(Post, id=post_id)
    user = request.user
    
    # 이미 좋아요를 눌렀으면 취소, 아니면 추가
    if user in post.like_users.all():
        post.like_users.remove(user)
    else:
        post.like_users.add(user)
    
    return redirect('ddokdam:detail', id=post_id)