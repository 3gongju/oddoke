from django.shortcuts import render, redirect
from .forms import CustomUserCreationForm, CustomAuthenticationForm
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from .models import User
from django.contrib.auth.decorators import login_required

# Create your views here.
def signup(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            return redirect('accounts:login')
    else:
        form = CustomUserCreationForm()
    
    context = {
        'form': form,
    }

    return render(request, 'signup.html', context)

def login(request):
    if request.method == 'POST':
        form = CustomAuthenticationForm(request, request.POST)
        if form.is_valid():

            user = form.get_user()

            auth_login(request, user)

            return redirect('ddokfarm:index')
    else:
        form = CustomAuthenticationForm()

    context = {
        'form': form,
    }

    return render(request, 'login.html', context)

@login_required
def logout(request):
    auth_logout(request)
    return redirect('ddokfarm:index')
