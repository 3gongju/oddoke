# ddokfarm/admin.py 업데이트

from django.contrib import admin
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment, ExchangeItem, ItemPrice

# 기존 admin 등록에 ExchangeItem 추가
admin.site.register(FarmSellPost)
admin.site.register(FarmRentalPost) 
admin.site.register(FarmSplitPost)
admin.site.register(FarmComment)

# ✅ 새로 추가되는 모델들
@admin.register(ExchangeItem)
class ExchangeItemAdmin(admin.ModelAdmin):
    list_display = ['post', 'give_description_short', 'want_description_short', 'created_at']
    list_filter = ['created_at']
    search_fields = ['post__title', 'give_description', 'want_description']
    readonly_fields = ['created_at', 'updated_at']
    
    def give_description_short(self, obj):
        return obj.give_description[:50] + "..." if len(obj.give_description) > 50 else obj.give_description
    give_description_short.short_description = "주는 것"
    
    def want_description_short(self, obj):
        return obj.want_description[:50] + "..." if len(obj.want_description) > 50 else obj.want_description
    want_description_short.short_description = "받고 싶은 것"

@admin.register(ItemPrice)
class ItemPriceAdmin(admin.ModelAdmin):
    list_display = ['post_title', 'item_name', 'price', 'is_price_undetermined', 'created_at']
    list_filter = ['is_price_undetermined', 'created_at', 'content_type']
    search_fields = ['item_name']
    readonly_fields = ['created_at']
    
    def post_title(self, obj):
        return obj.post.title if obj.post else "N/A"
    post_title.short_description = "게시글"