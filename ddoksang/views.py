from datetime import timedelta
from django.conf import settings
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from .models import BdayCafe, CafeFavorite
from artist.models import Artist, Member
from django.db.models import Q
from .models import BdayCafe
from django.views.decorators.http import require_GET


import json
from django.contrib.auth.decorators import user_passes_test

def admin_required(view_func):
    return user_passes_test(lambda u: u.is_superuser or u.is_staff)(view_func)


def is_admin_user(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)

@require_GET
def member_autocomplete(request):
    q = request.GET.get('q', '').strip()
    results = []

    if q:
        members = Member.objects.filter(
            Q(member_name__icontains=q)
        ).prefetch_related('artist_name')[:10]

        for member in members:
            artist_names = member.artist_name.all()
            if artist_names:
                artist = artist_names[0]
                artist_display = ' / '.join([a.display_name for a in artist_names])
                results.append({
                    'member_id': member.id,
                    'artist_id': artist.id,
                    'member_name': member.member_name,
                    'artist_display': artist_display,
                    'bday': member.member_bday,
                })

    return JsonResponse({'results': results})


def home_view(request):
    today = timezone.now().date()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    week_bdays = [(start_of_week + timedelta(days=i)).strftime('%m-%d') for i in range(7)]

    artists = Artist.objects.filter(
        members__member_bday__in=week_bdays
    ).distinct()

    cafes = BdayCafe.objects.filter(status="approved").order_by('-created_at')[:6]

    context = {
        'artists': artists,
        'cafes': cafes,
    }
    return render(request, 'ddoksang/home.html', context)


def map_view(request):
    active_bday_cafes = BdayCafe.objects.filter(
        status='approved',
        start_date__lte=timezone.now().date(),
        end_date__gte=timezone.now().date()
    ).select_related('artist', 'member')

    bday_cafe_data = [b.get_kakao_map_data() for b in active_bday_cafes]

    context = {
        'bday_cafes_json': json.dumps(bday_cafe_data),
        'total_bday_cafes': len(bday_cafe_data),
        'kakao_api_key': getattr(settings, 'KAKAO_MAP_API_KEY', ''),
    }
    return render(request, 'ddoksang/tour_map.html', context)


@login_required
def create_cafe(request):
    if request.method == "POST":
        artist_id = request.POST.get("artist_id")
        member_id = request.POST.get("member_id")
        cafe_name = request.POST.get("cafe_name")
        address = request.POST.get("address")
        start_date = request.POST.get("start_date")
        end_date = request.POST.get("end_date")

        if not (artist_id and cafe_name and address and start_date and end_date):
            messages.error(request, "필수 항목을 모두 입력해주세요.")
            return redirect("ddoksang:create")

        artist = Artist.objects.get(id=artist_id)
        member = Member.objects.get(id=member_id) if member_id else None

        BdayCafe.objects.create(
            submitted_by=request.user,
            artist=artist,
            member=member,
            cafe_name=cafe_name,
            address=address,
            road_address=request.POST.get("road_address", ""),
            latitude=request.POST.get("latitude", 0),
            longitude=request.POST.get("longitude", 0),
            kakao_place_id=request.POST.get("kakao_place_id", ""),
            start_date=start_date,
            end_date=end_date,
            event_description=request.POST.get("event_description", ""),
            special_benefits=request.POST.get("special_benefits", ""),
            hashtags=request.POST.get("hashtags", ""),
            twitter_source=request.POST.get("twitter_source", ""),
            instagram_source=request.POST.get("instagram_source", ""),
            status="pending"
        )
        messages.success(request, "생일 카페가 성공적으로 등록되었습니다.")
        return redirect("ddoksang:my_cafes")

    context = {
        "kakao_api_key": settings.KAKAO_MAP_API_KEY,
        "artists": Artist.objects.all(),
        "members": Member.objects.select_related().all()
    }
    return render(request, "ddoksang/create.html", context)


@login_required
def my_cafes(request):
    cafes = BdayCafe.objects.filter(
        submitted_by=request.user
    ).select_related('artist', 'member').order_by('-created_at')
    return render(request, 'ddoksang/my_cafes.html', {'cafes': cafes})


@login_required
def bday_cafe_detail(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id, status='approved')
    is_favorited = CafeFavorite.objects.filter(user=request.user, cafe=cafe).exists()
    return render(request, 'ddoksang/detail.html', {'cafe': cafe, 'is_favorited': is_favorited})


def bday_cafe_list_api(request):
    cafes = BdayCafe.objects.filter(
        status='approved'
    ).select_related('artist', 'member').order_by('-start_date')

    data = []
    for cafe in cafes:
        data.append({
            'id': cafe.id,
            'name': cafe.cafe_name,
            'artist': cafe.artist.display_name,
            'member': cafe.member.member_name if cafe.member else None,
            'latitude': float(cafe.latitude),
            'longitude': float(cafe.longitude),
            'start_date': cafe.start_date.strftime('%Y-%m-%d'),
            'end_date': cafe.end_date.strftime('%Y-%m-%d'),
            'main_image': cafe.main_image.url if cafe.main_image else None,
        })

    return JsonResponse({'success': True, 'bday_cafes': data, 'total': len(data)})


# ✅ 찜 토글 뷰
@login_required
def toggle_favorite(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    favorite, created = CafeFavorite.objects.get_or_create(user=request.user, cafe=cafe)

    if not created:
        favorite.delete()
        is_favorited = False
    else:
        is_favorited = True

    return JsonResponse({'is_favorited': is_favorited})

@admin_required
def admin_cafe_list(request):
    pending_cafes = BdayCafe.objects.filter(status='pending').select_related('artist', 'member')
    return render(request, 'admin/ddoksang/cafe_list.html', {'cafes': pending_cafes})

@admin_required
def reject_cafe(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    cafe.status = 'rejected'
    cafe.verified_by = request.user
    cafe.verified_at = timezone.now()
    cafe.save()
    messages.error(request, "생일카페가 거절되었습니다.")
    return redirect('ddoksang:admin_cafe_list')

@admin_required
def approve_cafe(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    cafe.status = 'approved'
    cafe.verified_at = timezone.now()
    cafe.verified_by = request.user
    cafe.save()
    messages.success(request, "해당 생카가 승인되었습니다.")
    return redirect('ddoksang:admin_dashboard')

@admin_required
def reject_cafe(request, cafe_id):
    cafe = get_object_or_404(BdayCafe, id=cafe_id)
    cafe.status = 'rejected'
    cafe.verified_at = timezone.now()
    cafe.verified_by = request.user
    cafe.save()
    messages.success(request, "해당 생카가 거절되었습니다.")
    return redirect('ddoksang:admin_dashboard')

# 검색뷰
def search_view(request):
    query = request.GET.get("q", "")
    results = []

    if query:
        results = BdayCafe.objects.filter(
            Q(cafe_name__icontains=query) |
            Q(artist__name__icontains=query) |
            Q(member__name__icontains=query) |
            Q(address__icontains=query)
        ).distinct()

    context = {
        "query": query,
        "results": results
    }
    return render(request, "ddoksang/search_results.html", context)

@admin_required
def admin_dashboard(request):
    # 승인 상태별 카운트
    stats = {
        'pending': BdayCafe.objects.filter(status='pending').count(),
        'approved': BdayCafe.objects.filter(status='approved').count(),
        'rejected': BdayCafe.objects.filter(status='rejected').count(),
        'total': BdayCafe.objects.all().count(),
        'this_month': BdayCafe.objects.filter(
            created_at__month=timezone.now().month
        ).count(),
    }

    # 최근 등록된 생카 5개
    recent_cafes = BdayCafe.objects.select_related('artist', 'member').order_by('-created_at')[:5]

    # 승인 대기중인 생카 5개
    pending_cafes = BdayCafe.objects.filter(status='pending').select_related('artist', 'member').order_by('created_at')[:5]

    return render(request, 'admin/ddoksang/dashboard.html', {
        'stats': stats,
        'recent_cafes': recent_cafes,
        'pending_cafes': pending_cafes,
    })
    