from django.shortcuts import render, redirect
from .forms import PostForm
from .models import Post
from django.contrib.auth.decorators import login_required

# Create your views here.
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

def detail(detail, id):
    article = Post.objects.get(id=id)

    context = {
        'post': post,
    }

    return render(request, 'detail.html', context)