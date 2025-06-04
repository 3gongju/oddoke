from itertools import chain
from django.http import Http404
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment
from .forms import FarmSellPostForm, FarmRentalPostForm, FarmSplitPostForm
from types import SimpleNamespace
from django.urls import reverse
from django.contrib.contenttypes.models import ContentType

# url 넘기기
def get_ddokfarm_category_urls():
    return [
        ("전체", "", reverse("ddokfarm:index")),
        ("판매/구매", "sell", reverse("ddokfarm:sell_index")),
        ("대여", "rental", reverse("ddokfarm:rental_index")),
        ("분철", "split", reverse("ddokfarm:split_index")),
    ]

# 카테고리 버튼
def get_ddokfarm_categories():
    return [
        SimpleNamespace(label='구매/판매', value='sell'),
        SimpleNamespace(label='대여', value='rental'),
        SimpleNamespace(label='분철', value='split'),
    ]

# 공통 js를 위한 유틸
def get_ajax_base_context(request):
    app_name = request.resolver_match.app_name
    return {
        "ajax_base_url": f"/{app_name}/ajax"
    }

# 카테고리 문자열에 맞는 게시글 모델 반환
def get_post_model(category):
    return {
        'sell': FarmSellPost,
        'rental': FarmRentalPost,
        'split': FarmSplitPost,
    }.get(category)

# 카테고리 문자열에 맞는 게시글 폼 클래스 반환
def get_post_form(category):
    return {
        'sell': FarmSellPostForm,
        'rental': FarmRentalPostForm,
        'split': FarmSplitPostForm,
    }.get(category)

# 카테고리에 따라 해당 게시글의 댓글 쿼리셋 반환
def get_post_comments(post):
    content_type = ContentType.objects.get_for_model(post.__class__)
    return FarmComment.objects.filter(content_type=content_type, object_id=post.id)

# 카테고리별 게시글 목록 반환 (전체일 경우 모두 병합)
def get_post_queryset(category=None):
    model_map = {
        'sell': (FarmSellPost, 'sell'),
        'rental': (FarmRentalPost, 'rental'),
        'split': (FarmSplitPost, 'split'),
    }

    if category in model_map:
        model, cat = model_map[category]
        posts = model.objects.all()
        for post in posts:
            post.category = cat  # 동적으로 category 속성 부여
        return posts

    # 전체 게시글 합치기
    all_posts = []
    for model, cat in model_map.values():
        posts = model.objects.all()
        for post in posts:
            post.category = cat  # 템플릿에서 구분용
        all_posts.append(posts)

    return chain(*all_posts)  # generator 반환