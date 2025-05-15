from django.shortcuts import render, redirect
from .forms import PostForm, CommentForm
from .models import Post, Comment
from django.contrib.auth.decorators import login_required

# Create your views here.
def main(request):
    return render(request, 'base.html')

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
    form = CommentForm(request.POST)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.user = request.user
        comment.post_id = post_id
        comment.save()

        return redirect('ddokfarm:detail', id=post_id)

@login_required
def comment_delete(request, post_id, id): # id의 id값을 찾음.
    comment = Comment.objects.get(id=id)
    comment.delete()

    return redirect('ddokfarm:detail', id=post_id) # detail로 돌아감.