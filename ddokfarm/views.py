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
    form = CommentForm()

    context = {
        'posts': posts,
        'form':form,
    }

    return render(request, 'index.html', context)

def detail(request, id):
    post = Post.objects.get(id=id)

    context = {
        'post': post,
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