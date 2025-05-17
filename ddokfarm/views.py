from django.shortcuts import render, redirect
from .forms import PostForm, CommentForm
from .models import Post, Comment
from django.contrib.auth.decorators import login_required

def main(request):
    return render(request, 'main/home.html') #home.html로 렌더링

@login_required
def create(request):
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.save()
            return redirect('ddokfarm:index')
    else:
        form = PostForm()
    
    context = {'form': form,}

    return render(request, 'create.html', context)

def index(request):
    posts = Post.objects.all()

    context = {
        'posts': posts,
    }

    return render(request, 'index.html', context)

@login_required
def update(request, id):
    post = Post.objects.get(id=id) 
    
    if request.method == 'POST':
            form = PostForm(request.POST, instance=post) 
            if form.is_valid(): # form에 대해 유효성 검사
                form.save()
                return redirect('ddokfarm:detail', id=id)

    else:
        form = PostForm(instance=post) #instance

    context = {
        'form':form,
    }

    return render(request, 'update.html', context)

@login_required
def delete(request, id):
    post = Post.objects.get(id=id)
    post.delete()

    return redirect('ddokfarm:index')

def detail(request, id):
    post = Post.objects.get(id=id)
    comments = post.comment_set.all() 
    form = CommentForm()

    context = {
        'post': post,
        'comments': comments,
        'form':form,
    }

    return render(request, 'detail.html', context)


@login_required
def comment_create(request, post_id):
    try:
        post = Post.objects.get(id=post_id)
    except Post.DoesNotExist:
        # post가 없는 경우에도 404 대신 안전한 리디렉션 또는 메시지 처리
        return redirect('ddokfarm:index')  # 예: 게시판 메인으로 이동

    if request.method == 'POST':
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.user = request.user
            comment.post = post
            comment.save()

    # 폼이 유효하지 않거나 GET 요청일 경우에도 detail로 이동
    return redirect('ddokfarm:detail', post_id=post.id)

@login_required
def comment_delete(request, post_id, id): # id의 id값을 찾음.
    comment = Comment.objects.get(id=id)
    comment.delete()

    return redirect('ddokfarm:detail', id=post_id) # detail로 돌아감.