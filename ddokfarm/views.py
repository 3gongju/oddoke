from django.shortcuts import render, redirect
from .forms import PostForm

# Create your views here.
def create(request):
    if request.method == 'POST':
        form = PostForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('ddokfarm:index')
    else:
        form = PostForm()
    
    context = {'form': form,}

    return render(requestm 'create.html', context)