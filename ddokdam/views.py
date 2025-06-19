import logging
from django.template.loader import render_to_string
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponseForbidden, HttpResponseNotAllowed
from django.views.decorators.http import require_POST, require_GET
from django.http import JsonResponse, HttpResponse
from django.urls import reverse
from django.db.models import Q, F
from django.contrib.contenttypes.models import ContentType
from django.contrib import messages
from django.conf import settings
from operator import attrgetter
from itertools import chain
from artist.models import Member, Artist
from .models import DamComment, DamCommunityPost, DamMannerPost, DamBdaycafePost, DamPostImage, DamPostReport
from .forms import DamCommentForm, DamPostReportForm
from .utils import (
    get_post_model,
    get_post_form,
    get_post_comments,
    get_post_queryset,
    get_ajax_base_context,
    get_ddokdam_categories,
    get_ddokdam_category_urls,
)

logger = logging.getLogger(__name__)

def index(request):
    category = request.GET.get('category')
    query = request.GET.get('q', '').strip()

    if query:
        artist_filter = (
            Q(artist__display_name__icontains=query) |
            Q(artist__korean_name__icontains=query) |
            Q(artist__english_name__icontains=query) |
            Q(artist__alias__icontains=query)
        )
        member_filter = Q(members__member_name__icontains=query)
        text_filter = Q(title__icontains=query) | Q(content__icontains=query)
        common_filter = text_filter | artist_filter | member_filter

        community_results = DamCommunityPost.objects.filter(common_filter).distinct()
        manner_results = DamMannerPost.objects.filter(common_filter).distinct()
        bdaycafe_results = DamBdaycafePost.objects.filter(common_filter).distinct()

        posts = sorted(
            chain(community_results, manner_results, bdaycafe_results),
            key=attrgetter('created_at'),
            reverse=True
        )
    else:
        posts = get_post_queryset(category)
        posts = sorted(posts, key=attrgetter('created_at'), reverse=True)

    for post in posts:
        post.detail_url = reverse('ddokdam:post_detail', args=[post.category_type, post.id])

    clean_category = (category or 'community').split('?')[0]

    context = {
        'posts': posts,
        'category': category,
        'query': query,
        'search_action': reverse('ddokdam:index'),
        'create_url': f"{reverse('ddokdam:post_create')}?category={clean_category}",
        'category_urls': get_ddokdam_category_urls(),
        'default_category': 'community',
    }

    return render(request, 'ddokdam/index.html', context)

# 커뮤니티 게시글 보기
def community_index(request):
    return redirect('/ddokdam/?category=community')

# 덕매너 게시글 보기
def manner_index(request):
    return redirect('/ddokdam/?category=manner')

# 생카 게시글 보기
def bdaycafe_index(request):
    return redirect('/ddokdam/?category=bdaycafe')

# 게시글 상세보기
def post_detail(request, category, post_id):
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")

    post = get_object_or_404(model, id=post_id)

    model.objects.filter(id=post_id).update(view_count=F('view_count') + 1)
    post.refresh_from_db(fields=['view_count'])

    comment_qs = get_post_comments(post)
    comments = comment_qs.filter(parent__isnull=True).select_related('user').prefetch_related('replies__user')
    total_comment_count = comment_qs.count()
    comment_form = DamCommentForm()
    is_liked = request.user.is_authenticated and post.like.filter(id=request.user.id).exists()
    comment_create_url = reverse('ddokdam:comment_create', kwargs={'category': category, 'post_id': post_id})
    is_owner = request.user == post.user
    
    # 카카오맵 API 키 추가
    kakao_api_key = (
        getattr(settings, 'KAKAO_MAP_API_KEY', '') or 
        getattr(settings, 'KAKAO_API_KEY', '') or
        ''
    )


    context = {
        'post': post,
        'category': category,
        'comments': comments,
        'total_comment_count': total_comment_count,
        'comment_form': comment_form,
        'is_liked': is_liked,
        'artist': post.artist,
        'members': post.members.all(),
        'app_name': 'ddokdam',
        'comment_create_url': comment_create_url,
        'comment_delete_url_name': 'ddokdam:comment_delete',
        'is_owner': is_owner,
        'kakao_api_key': kakao_api_key,  # 카카오맵 API 키 추가
    }

    return render(request, 'ddokdam/detail.html', context)


# 게시글 작성
@login_required
def post_create(request):
    favorite_artists = Artist.objects.filter(followers=request.user)

    if request.method == 'POST':
        category = request.POST.get('category')
        selected_artist_id = request.POST.get('artist')
        selected_member_ids = list(set(map(int, request.POST.getlist('members'))))
        image_files = request.FILES.getlist('images')
        form_class = get_post_form(category)
        if not form_class:
            raise Http404("존재하지 않는 카테고리입니다.")

        form = form_class(request.POST, request.FILES)
        if form.is_valid():
            if not image_files:
                form.add_error(None, "이미지는 최소 1장 이상 업로드해야 합니다.")
            else:
                post = form.save(commit=False)
                post.user = request.user
                if selected_artist_id:
                    post.artist_id = selected_artist_id
                post.save()
                post.members.set(selected_member_ids)
                form.save_m2m()

                content_type = ContentType.objects.get_for_model(post.__class__)
                for idx, image in enumerate(image_files):
                    DamPostImage.objects.create(
                        image=image,
                        content_type=content_type,
                        object_id=post.id,
                        is_representative=(idx == 0)
                    )

                return redirect('ddokdam:post_detail', category=category, post_id=post.id)
    else:
        raw_category = request.GET.get('category') or 'community'
        category = raw_category.split('?')[0]

        selected_artist_id = None
        selected_member_ids = []
        form_class = get_post_form(category)
        if not form_class:
            raise Http404("존재하지 않는 카테고리입니다.")
        form = form_class()

    default_artist_id = int(request.GET.get('artist')) if request.GET.get('artist') else (
        favorite_artists[0].id if favorite_artists.exists() else None
    )

    selected_members = []
    if default_artist_id:
        selected_members = Member.objects.filter(artist_name__id=default_artist_id).distinct()

    # ✅ 카카오맵 API 키 추가
    kakao_api_key = (
        getattr(settings, 'KAKAO_MAP_API_KEY', '') or 
        getattr(settings, 'KAKAO_API_KEY', '') or
        ''
    )

    context = {
        'form': form,
        'category': category,
        'sorted_artists': favorite_artists,
        'default_artist_id': default_artist_id,
        'selected_members': selected_members,
        'selected_member_ids': selected_member_ids,
        'post': None,
        'submit_label': '작성 완료',
        'cancel_url': reverse('ddokdam:index'),
        **get_ajax_base_context(request),
        'mode': 'create',
        'categories': get_ddokdam_categories(),
        'kakao_api_key': kakao_api_key,  # ✅ 카카오맵 API 키 추가
    }

    return render(request, 'ddokdam/create.html', context)


# 아티스트 검색
@login_required
def search_artists(request):
    query = request.GET.get('q', '')
    if query:
        results = Artist.objects.filter(
            Q(display_name__icontains=query) |
            Q(korean_name__icontains=query) |
            Q(english_name__icontains=query) |
            Q(alias__icontains=query)
        )[:10]
    else:
        results = []

    data = {
        "results": [
            {"id": artist.id, "name": artist.display_name}
            for artist in results
        ]
    }

    return JsonResponse(data)

# 게시글 수정
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
            'back_url': reverse('ddokdam:post_detail', args=[category, post.id]),
        }
        return render(request, 'ddokdam/error_message.html', context)

    if request.method == 'POST':
        # ✅ 덕팜 방식: POST 데이터 복사 후 artist 강제 설정
        post_data = request.POST.copy()
        post_data['artist'] = post.artist.id

        form = form_class(post_data, request.FILES, instance=post)
        image_files = request.FILES.getlist('images')  # 새 이미지 받기
        removed_ids = post_data.get('removed_image_ids', '').split(',')  # ✅ post_data 사용
        removed_ids = [int(id) for id in removed_ids if id.isdigit()]  # 삭제할 ID만 정수로 처리
        selected_member_ids = list(map(int, post_data.getlist('members')))  # ✅ post_data 사용

        if form.is_valid():
            post = form.save(commit=False)
            post.save()

            # ✅ 덕팜과 동일한 순서: 멤버 설정 → 이미지 삭제 → 이미지 추가 → save_m2m
            post.members.set(selected_member_ids)

            if removed_ids:
                post.images.filter(id__in=removed_ids).delete()

            if image_files:
                content_type = ContentType.objects.get_for_model(post.__class__)
                for idx, image in enumerate(image_files):
                    DamPostImage.objects.create(
                        image=image,
                        content_type=content_type,
                        object_id=post.id,
                        is_representative=(idx == 0)
                    )

            form.save_m2m()
            return redirect('ddokdam:post_detail', category=category, post_id=post.id)

    else:
        form = form_class(instance=post)

    # ✅ 덕팜과 동일한 existing_images 생성 방식
    existing_images = [
        {"id": img.id, "url": img.image.url if img.image else f"{settings.MEDIA_URL}default.jpg"}
        for img in post.images.all()
    ]
    sorted_artists = Artist.objects.order_by('display_name')
    selected_members = Member.objects.filter(artist_name=post.artist).distinct()
    selected_member_ids = list(post.members.values_list('id', flat=True))
    selected_artist_id = post.artist.id if post.artist else None

    # ✅ 카카오맵 API 키 추가
    kakao_api_key = (
        getattr(settings, 'KAKAO_MAP_API_KEY', '') or 
        getattr(settings, 'KAKAO_API_KEY', '') or
        ''
    )

    context = {
        'form': form,
        'post': post,
        'category': category,
        'sorted_artists': sorted_artists,
        'selected_members': selected_members,
        'selected_member_ids': selected_member_ids,
        'selected_artist_id': selected_artist_id,
        'submit_label': '수정 완료',
        'cancel_url': reverse('ddokdam:post_detail', args=[category, post.id]),
        'mode': 'edit',
        'categories': get_ddokdam_categories(),
        **get_ajax_base_context(request),
        'existing_images': existing_images,
        'kakao_api_key': kakao_api_key,  # ✅ 카카오맵 API 키 추가
    }

    return render(request, 'ddokdam/edit.html', context)

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
            'back_url': reverse('ddokdam:post_detail', args=[category, post.id]),
        }

        return render(request, 'ddokdam/error_message.html', context)

    if request.method == 'POST':
        post.delete()

        return redirect(f"{reverse('ddokdam:index')}?category={category}")

    context = {
    'title': '잘못된 접근입니다',
    'message': '게시글 삭제는 버튼을 통해서만 가능합니다.',
    'back_url': reverse('ddokdam:post_detail', args=[category, post.id])
    }

    return render(request, 'ddokdam/error_message.html', context)

# 댓글 작성
@login_required
@require_POST
def comment_create(request, category, post_id):
    post_model = get_post_model(category)
    if not post_model:
        raise Http404("존재하지 않는 카테고리입니다.")
    post = get_object_or_404(post_model, id=post_id)

    form = DamCommentForm(request.POST)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.user = request.user

        # 연결된 게시글 설정
        comment.content_type = ContentType.objects.get_for_model(post.__class__)
        comment.object_id = post.id

        # 대댓글인 경우
        parent_id = request.POST.get("parent")
        if parent_id:
            comment.parent = get_object_or_404(DamComment, id=parent_id)

        comment.save()

        if request.headers.get("x-requested-with") == "XMLHttpRequest":
            html = render_to_string(
                "components/post_detail/_comment_list.html",  # 동일 템플릿 사용
                {
                    "comment": comment,
                    "is_reply": bool(parent_id),
                    "post": post,
                    "category": category,
                    "comment_create_url": reverse("ddokdam:comment_create", args=[category, post_id])
                },
                request=request
            )
            return HttpResponse(html)

    return redirect("ddokdam:post_detail", category=category, post_id=post_id)

# 댓글 삭제
@login_required
@require_POST
def comment_delete(request, category, post_id, comment_id):
    comment = get_object_or_404(DamComment, id=comment_id)

    # 연결된 게시글과 ID 확인
    if not (comment.content_type.model == get_post_model(category)._meta.model_name and comment.object_id == int(post_id)):
        return HttpResponseForbidden()

    if request.user != comment.user:
        return HttpResponseForbidden()

    # 실제 삭제 대신 삭제 표시
    comment.is_deleted = True
    comment.content = "삭제된 댓글입니다"
    comment.save()

    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return HttpResponse(status=204)

    return redirect('ddokdam:post_detail', category=category, post_id=post_id)

# 좋아요
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

# 아티스트 선택시 멤버 목록 출력
def get_members_by_artist(request, artist_id):
    members = Member.objects.filter(artist_name__id=artist_id).distinct()
    member_data = [
        {"id": member.id, "name": member.member_name}
        for member in members
    ]
    
    return JsonResponse({"members": member_data})

# 생카후기 작성 시 덕생 카페 자동완성 API

@require_GET
def search_ddoksang_cafes(request):
    """생카후기 작성 시 덕생 카페 자동완성 API"""
    query = request.GET.get('q', '').strip()
    
    if len(query) < 2:
        return JsonResponse({'success': True, 'cafes': []})
    
    try:
        # ddoksang 앱 import
        try:
            from ddoksang.models import BdayCafe
        except ImportError:
            return JsonResponse({
                'success': False, 
                'error': 'ddoksang 앱을 찾을 수 없습니다.'
            })
        
        # 검색 쿼리 실행
        cafes = BdayCafe.objects.filter(
            status='approved',
            cafe_name__icontains=query
        ).select_related('artist', 'member')[:10]
        
        # 결과 처리
        cafe_results = []
        
        for cafe in cafes:
            try:
                # 유사도 계산
                from difflib import SequenceMatcher
                similarity = SequenceMatcher(None, query.lower(), cafe.cafe_name.lower()).ratio()
                
                cafe_data = {
                    'id': cafe.id,
                    'cafe_name': cafe.cafe_name,
                    'artist_id': cafe.artist.id if cafe.artist else None,
                    'artist_name': cafe.artist.display_name if cafe.artist else '',
                    'member_id': cafe.member.id if cafe.member else None,
                    'member_name': cafe.member.member_name if cafe.member else '',
                    'address': cafe.address,
                    'main_image': getattr(cafe, 'get_main_image', lambda: None)(),
                    'is_active': getattr(cafe, 'is_active', False),
                    'detail_url': f'/ddoksang/cafe/{cafe.id}/',
                    'similarity': similarity,
                    'start_date': cafe.start_date.strftime('%Y-%m-%d'),
                    'end_date': cafe.end_date.strftime('%Y-%m-%d'),
                }
                cafe_results.append(cafe_data)
                
            except Exception:
                continue
        
        # 유사도 순으로 정렬
        cafe_results.sort(key=lambda x: x['similarity'], reverse=True)
        
        return JsonResponse({
            'success': True, 
            'cafes': cafe_results
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False, 
            'error': str(e)
        }, status=500)


@login_required
@require_POST
def report_post(request, category, post_id):
    """게시글 신고 처리"""
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")
    
    post = get_object_or_404(model, id=post_id)
    
    # 자신의 게시글은 신고할 수 없음
    if request.user == post.user:
        return JsonResponse({
            'success': False, 
            'error': '자신의 게시글은 신고할 수 없습니다.'
        })
    
    # 이미 신고한 경우 중복 신고 방지
    existing_report = DamPostReport.objects.filter(
        reporter=request.user,
        content_type=ContentType.objects.get_for_model(post.__class__),
        object_id=post.id
    ).first()
    
    if existing_report:
        return JsonResponse({
            'success': False,
            'error': '이미 신고한 게시글입니다.'
        })
    
    form = DamPostReportForm(request.POST)
    
    if form.is_valid():
        report = form.save(commit=False)
        report.reporter = request.user
        report.reported_user = post.user
        report.content_type = ContentType.objects.get_for_model(post.__class__)
        report.object_id = post.id
        report.save()
        
        return JsonResponse({
            'success': True,
            'message': '신고가 접수되었습니다. 검토 후 조치하겠습니다.'
        })
    else:
        return JsonResponse({
            'success': False,
            'error': '신고 정보를 확인해주세요.',
            'form_errors': form.errors
        })

@login_required
@require_GET  
def get_report_form(request, category, post_id):
    """신고 폼 HTML 반환"""
    model = get_post_model(category)
    if not model:
        raise Http404("존재하지 않는 카테고리입니다.")
    
    post = get_object_or_404(model, id=post_id)
    
    # 자신의 게시글은 신고할 수 없음
    if request.user == post.user:
        return JsonResponse({
            'success': False,
            'error': '자신의 게시글은 신고할 수 없습니다.'
        })
    
    # 이미 신고한 경우
    existing_report = DamPostReport.objects.filter(
        reporter=request.user,
        content_type=ContentType.objects.get_for_model(post.__class__),
        object_id=post.id
    ).first()
    
    if existing_report:
        return JsonResponse({
            'success': False,
            'error': '이미 신고한 게시글입니다.'
        })
    
    form = DamPostReportForm()
    
    # 폼 HTML 렌더링
    form_html = render_to_string('ddokdam/components/_report_form.html', {
        'form': form,
        'post': post,
        'category': category,
    }, request=request)
    
    return JsonResponse({
        'success': True,
        'form_html': form_html
    })