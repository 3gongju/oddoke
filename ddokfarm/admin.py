from django.contrib import admin
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment

# Register your models here.
admin.site.register(FarmSellPost)
admin.site.register(FarmRentalPost)
admin.site.register(FarmSplitPost)
admin.site.register(FarmComment)

