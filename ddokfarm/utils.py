from itertools import chain
from django.http import Http404
from .models import FarmSellPost, FarmRentalPost, FarmSplitPost, FarmComment
from .forms import FarmSellPostForm, FarmRentalPostForm, FarmSplitPostForm
from types import SimpleNamespace
from django.urls import reverse

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
def get_post_comments(category, post):
    if category == 'sell':
        return FarmComment.objects.filter(sell_post=post)
    elif category == 'rental':
        return FarmComment.objects.filter(rental_post=post)
    elif category == 'split':
        return FarmComment.objects.filter(split_post=post)
    return FarmComment.objects.none()

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

# 댓글 인스턴스에 게시글 연결
def assign_post_to_comment(comment, category, post):
    if category == 'sell':
        comment.sell_post = post
    elif category == 'rental':
        comment.rental_post = post
    elif category == 'split':
        comment.split_post = post
    else:
        raise Http404("유효하지 않은 카테고리입니다.")

# 댓글이 해당 게시글에 속하는지 검증
def get_comment_post_field_and_id(comment, category, post_id):
    if category == 'sell' and comment.sell_post_id == post_id:
        return 'sell_post', comment.sell_post_id
    elif category == 'rental' and comment.rental_post_id == post_id:
        return 'rental_post', comment.rental_post_id
    elif category == 'split' and comment.split_post_id == post_id:
        return 'split_post', comment.split_post_id
    raise Http404("댓글이 해당 게시글에 속하지 않습니다.")
