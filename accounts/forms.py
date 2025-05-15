from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import User

class CustomUserCreationForm(UserCreationForm):
    class Meta():
        model = User
        fields = ('username', 'profile_image', )

class CustomAuthenticationForm(AuthenticationForm):
    pass