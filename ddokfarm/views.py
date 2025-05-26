from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponseForbidden, HttpResponseNotAllowed
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.urls import reverse
from operator import attrgetter
from .models import FarmComment
from .forms import FarmCommentForm
from .utils import get_post_model, get_post_form, get_post_comments, get_post_queryset, assign_post_to_comment, get_comment_post_field_and_id


# ✅ 홈 화면 (루트 URL)
def main(request):
    return render(request, 'main/home.html')


# 전체 게시글 보기
def index(request):
    category = request.GET.get('category')
    posts = get_post_queryset(category)
    posts = sorted(posts, key=attrgetter('created_at'), reverse=True)

    context = {
        'posts': posts,
        'category': category,
    }
    return render(request, 'ddokfarm/index.html', context)

# 판매 게시글 보기
def sell_index(request):
    return redirect('/ddokfarm/?category=sell')

# 대여 게시글 보기
def rental_index(request):
    return redirect('/ddokfarm/?category=rental')

# 분철 게시글 보기
def split_index(request):
    return redirect('/ddokfarm/?category=split')

# 게시글 상세보기
def post_detail(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    comments = get_post_comments(category, post).filter(parent__isnull=True).select_related('user').prefetch_related('replies__user')

    total_comment_count = get_post_comments(category, post).count()

    comment_form = FarmCommentForm()

    is_liked = request.user.is_authenticated and post.like.filter(id=request.user.id).exists()

    context = {
        'post': post,
        'category': category,
        'comments': comments,
        'total_comment_count': total_comment_count,
        'comment_form': comment_form,
        'is_liked': is_liked,
    }

    return render(request, 'ddokfarm/post_detail_test.html', context)

# 게시글 작성
@login_required
def post_create(request):
    if request.method == 'POST':
        category = request.POST.get('category')
        form_class = get_post_form(category)

        if not form_class:
            raise Http404("존재하지 않는 카테고리입니다.")

        form = form_class(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.save()
            return redirect('ddokfarm:post_detail', category=category, post_id=post.id)
    else:
        # GET 요청 시 기본 카테고리 선택 (예: 'sell')
        category = request.GET.get('category', 'sell')
        form_class = get_post_form(category)

        if not form_class:
            raise Http404("존재하지 않는 카테고리입니다.")

        form = form_class()

    context = {
        'form': form,
        'category': category,
    }

    return render(request, 'ddokfarm/post_create.html', context)

# 게시글 수정
@login_required
def post_edit(request, category, post_id):
    model = get_post_model(category)
    form_class = get_post_form(category)

    if not model or not form_class:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '이 게시글을 수정할 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    if request.method == 'POST':
        form = form_class(request.POST, request.FILES, instance=post)
        if form.is_valid():
            form.save()
            return redirect('ddokfarm:post_detail', category=category, post_id=post.id)
    else:
        form = form_class(instance=post)

    context = {
        'form': form,
        'post': post,
        'category': category,
    }
    return render(request, 'ddokfarm/post_edit.html', context)

# 게시글 삭제
@login_required
def post_delete(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '이 게시글을 삭제할 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    if request.method == 'POST':
        post.delete()
        return redirect(f"{reverse('ddokfarm:index')}?category={category}")

    context = {
        'title': '잘못된 접근입니다',
        'message': '게시글 삭제는 버튼을 통해서만 가능합니다.',
        'back_url': reverse('ddokfarm:post_detail', args=[category, post.id])
    }
    return render(request, 'ddokfarm/error_message.html', context)

# 댓글 작성
@login_required
@require_POST
def comment_create(request, category, post_id):
    post_model = get_post_model(category)
    post = get_object_or_404(post_model, id=post_id)

    form = FarmCommentForm(request.POST)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.user = request.user

        # 연결된 게시글 설정
        assign_post_to_comment(comment, category, post)

        # 대댓글이면 부모 댓글 설정
        parent_id = request.POST.get("parent")
        if parent_id:
            comment.parent = get_object_or_404(FarmComment, id=parent_id)

        comment.save()

    return redirect('ddokfarm:post_detail', category=category, post_id=post_id)

# 댓글 삭제
@login_required
def comment_delete(request, category, post_id, comment_id):
    comment = get_object_or_404(FarmComment, id=comment_id)

    # 연결된 게시글과 ID 확인
    try:
        _, _ = get_comment_post_field_and_id(comment, category, post_id)
    except Http404:
        raise

    if request.user != comment.user:
        return HttpResponseForbidden()

    comment.delete()
    return redirect('ddokfarm:post_detail', category=category, post_id=post_id)

# 좋아요(찜하기)
@login_required
@require_POST
def like_post(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    if request.user in post.like.all():
        post.like.remove(request.user)
        liked = False
    else:
        post.like.add(request.user)
        liked = True

    return JsonResponse({'liked': liked, 'like_count': post.like.count()})

# 판매 완료 표시
@login_required
@require_POST
def mark_as_sold(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    # 작성자 권한 확인
    if request.user != post.user:
        context = {
            'title': '접근 권한 없음',
            'message': '판매 완료 처리를 할 권한이 없습니다.',
            'back_url': reverse('ddokfarm:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokfarm/error_message.html', context)

    # 판매 상태 토글
    post.is_sold = not post.is_sold
    post.save()

    return redirect('ddokfarm:post_detail', category=category, post_id=post.id)

# # ✅ 게시글 목록 (카테고리, 정렬 포함)
# def index(request):
#     posts = DdokfarmPost.objects.all().order_by('-created_at')

#     category_slug = request.GET.get('category')
#     current_category = None

#     if category_slug:
#         category = Category.objects.filter(slug=category_slug).first()
#         if category:
#             posts = posts.filter(category=category)
#             current_category = category.slug

#     # 정렬 조건
#     sort = request.GET.get('sort', 'latest')
#     if sort == 'price_low':
#         posts = posts.order_by('price')
#     elif sort == 'price_high':
#         posts = posts.order_by('-price')
#     else:
#         posts = posts.order_by('-created_at')

#     categories = Category.objects.all()

#     context = {
#         'posts': posts,
#         'categories': Category.objects.all(),
#         'current_category': current_category,
#         'current_sort': sort,
#     }

#     return render(request, 'ddokfarm/index.html', context)


# # ✅ 게시글 작성
# @login_required
# def create(request):
#     if request.method == 'POST':
#         form = DdokfarmPostForm(request.POST, request.FILES)
#         if form.is_valid():
#             post = form.save(commit=False)
#             post.user = request.user
#             post.category = form.cleaned_data['category'] 
#             post.save()
#             return redirect('ddokfarm:detail', post_id=post.id)
#     else:
#         form = DdokfarmPostForm()

#     categories = Category.objects.all()
#     return render(request, 'ddokfarm/create.html', {
#         'form': form, 
#         'categories': categories,
#     })


# # ✅ 게시글 상세 보기
# def detail(request, post_id):
#     post = get_object_or_404(DdokfarmPost, id=post_id)

#     comments = DdokfarmComment.objects.filter(post=post).select_related('user').prefetch_related('replies')

#     form = DdokfarmCommentForm()
#     context = {
#         'post': post,
#         'comments': comments,
#         'form': form,
#     }
#     return render(request, 'ddokfarm/detail.html', context)

# ✅ 게시글 수정
# @login_required
# def update(request, post_id):
#     post = get_object_or_404(DdokfarmPost, id=post_id)

#     if request.user != post.user:
#         return redirect('ddokfarm:detail', post_id=post.id)

#     if request.method == 'POST':
#         form = DdokfarmPostForm(request.POST, request.FILES, instance=post)
#         if form.is_valid():
#             form.save()
#             return redirect('ddokfarm:detail', post_id=post.id)
#     else:
#         form = DdokfarmPostForm(instance=post)

#     categories = Category.objects.all()
#     context = {
#         'form': form,
#         'post': post,
#         'categories': categories,
#     }
#     return render(request, 'ddokfarm/update.html', context)


# # ✅ 게시글 삭제
# @login_required
# @require_POST
# def delete(request, post_id):
#     post = get_object_or_404(DdokfarmPost, id=post_id)

#     if request.user != post.user:
#         return redirect('ddokfarm:detail', post_id=post.id)

#     post.delete()
#     return redirect('ddokfarm:index')

# # 찜하기 추가 
# @require_POST
# @login_required
# def toggle_like(request, post_id):
#     if not request.user.is_authenticated:
#         return JsonResponse({'error': '로그인 필요'}, status=403)

#     post = get_object_or_404(DdokfarmPost, id=post_id)
#     user = request.user

#     if user in post.liked_users.all():
#         post.liked_users.remove(user)
#         liked = False
#     else:
#         post.liked_users.add(user)
#         liked = True

#     return JsonResponse({'liked': liked, 'likes_count': post.liked_users.count()})

# # 판매 완료 표시시
# @require_POST
# @login_required
# def mark_as_sold(request, post_id):
#     post = get_object_or_404(DdokfarmPost, id=post_id)

#     if request.user != post.user:
#         return redirect('ddokfarm:detail', post_id=post.id)

#     post.is_sold = not post.is_sold
#     post.save()
#     return redirect('ddokfarm:detail', post_id=post.id)

# # ✅ 댓글 생성
# @require_POST
# @login_required
# def comment_create(request, post_id):
#     post = get_object_or_404(DdokfarmPost, id=post_id)
#     form = DdokfarmCommentForm(request.POST)

#     if form.is_valid():
#         comment = form.save(commit=False)
#         comment.user = request.user
#         comment.post = post
#         comment.save()
#         return redirect(f'{reverse("ddokfarm:detail", args=[post_id])}#comment-{comment.id}')

#     return redirect('ddokfarm:detail', post_id=post_id)



# # ✅ 댓글 삭제
# @login_required
# @require_POST
# def comment_delete(request, post_id, id):
#     comment = get_object_or_404(DdokfarmComment, id=id)

#     if request.user != comment.user:
#         return redirect('ddokfarm:detail', post_id=post_id)

#     comment.delete()
#     return redirect('ddokfarm:detail', post_id=post_id)
