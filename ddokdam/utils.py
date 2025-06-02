from itertools import chain
from django.http import Http404
from .models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment
from .forms import DamCommunityPostForm, DamMannerPostForm, DamBdaycafePostForm
from types import SimpleNamespace
from django.urls import reverse
from django.contrib.contenttypes.models import ContentType

# url 넘기기
def get_ddokdam_category_urls():
    return [
        ("전체", "", reverse("ddokdam:index")),
        ("덕담 한마디", "community", reverse("ddokdam:community_index")),
        ("예절 차리기", "manner", reverse("ddokdam:manner_index")),
        ("생카 후기", "bdaycafe", reverse("ddokdam:bdaycafe_index")),
    ]

# 카테고리 버튼
def get_ddokdam_categories():
    return [
        SimpleNamespace(label='덕담 한마디', value='community'),
        SimpleNamespace(label='예절 차리기', value='manner'),
        SimpleNamespace(label='생카 후기', value='bdaycafe'),
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
        'community': DamCommunityPost,
        'manner': DamMannerPost,
        'bdaycafe': DamBdaycafePost,
    }.get(category)


# 카테고리 문자열에 맞는 게시글 폼 클래스 반환
def get_post_form(category):
    return {
        'community': DamCommunityPostForm,
        'manner': DamMannerPostForm,
        'bdaycafe': DamBdaycafePostForm,
    }.get(category)


# 카테고리에 따라 해당 게시글의 댓글 쿼리셋 반환
def get_post_comments(post):
    content_type = ContentType.objects.get_for_model(post.__class__)
    return DamComment.objects.filter(content_type=content_type, object_id=post.id)


# 카테고리별 게시글 목록 반환 (전체일 경우 모두 병합)
def get_post_queryset(category=None):
    model_map = {
        'community': (DamCommunityPost, 'community'),
        'manner': (DamMannerPost, 'manner'),
        'bdaycafe': (DamBdaycafePost, 'bdaycafe'),
    }

    if category in model_map:
        model, cat = model_map[category]
        posts = model.objects.all()
        for post in posts:
            post.category = cat
        return posts

    # 전체 카테고리 합쳐서 반환
    all_posts = []
    for model, cat in model_map.values():
        posts = model.objects.all()
        for post in posts:
            post.category = cat
        all_posts.append(posts)

    return chain(*all_posts)
