from django.contrib import admin
from .models import BdayCafe, CafeFavorite, TourPlan, TourStop, UserSearchHistory

admin.site.register(BdayCafe)
admin.site.register(CafeFavorite)
admin.site.register(TourPlan)
admin.site.register(TourStop)
admin.site.register(UserSearchHistory)