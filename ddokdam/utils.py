from itertools import chain
from django.http import Http404
from .models import DamCommunityPost, DamMannerPost, DamBdaycafePost, DamComment
from .forms import DamCommunityPostForm, DamMannerPostForm, DamBdaycafePostForm

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
def get_post_comments(category, post):
    if category == 'community':
        return DamComment.objects.filter(community_post=post)
    elif category == 'manner':
        return DamComment.objects.filter(manner_post=post)
    elif category == 'bdaycafe':
        return DamComment.objects.filter(bdaycafe_post=post)
    return DamComment.objects.none()


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

# 댓글 인스턴스에 게시글을 연결해주는 함수
def assign_post_to_comment(comment, category, post):
    if category == 'community':
        comment.community_post = post
    elif category == 'manner':
        comment.manner_post = post
    elif category == 'bdaycafe':
        comment.bdaycafe_post = post
    else:
        raise Http404("유효하지 않은 카테고리입니다.")

# 댓글이 주어진 카테고리와 post_id에 올바르게 연결되어 있는지 확인.
# 연결된 post 필드명과 id를 반환하거나, 잘못되었으면 404.
def get_comment_post_field_and_id(comment, category, post_id):
    if category == 'community' and comment.community_post_id == post_id:
        return 'community_post', comment.community_post_id
    elif category == 'manner' and comment.manner_post_id == post_id:
        return 'manner_post', comment.manner_post_id
    elif category == 'bdaycafe' and comment.bdaycafe_post_id == post_id:
        return 'bdaycafe_post', comment.bdaycafe_post_id
    raise Http404("댓글이 해당 게시글에 속하지 않습니다.")


