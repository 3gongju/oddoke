from django.shortcuts import render, redirect
from .forms import PostForm
from .models import Post

# Create your views here.
def create(request):
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
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