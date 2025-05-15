from django.forms import ModelForm
from .models import Article

class PostForm(ModelForm):
    class Meta():
        model = Post
        fields = ('content', 'image', )