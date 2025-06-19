# bday_calendar/views.py
from datetime import date
from django.shortcuts import render
from django.http import JsonResponse
from artist.models import Member

def birthday_calendar(request):
    all_members = Member.objects.select_related().all()
    return render(request, 'bday_calendar/calendar.html', {
        'all_members': all_members
    })

def birthday_events_api(request):
    today = date.today()
    current_year = today.year

    members = Member.objects.exclude(member_bday__isnull=True).exclude(member_bday__exact='')

    events = []
    for member in members:
        try:
            mm, dd = map(int, member.member_bday.strip().split('-'))
            birthday = date(current_year, mm, dd)

            artist_names = member.artist_name.all()
            artist_display = ', '.join([a.display_name for a in artist_names]) if artist_names else "Unknown"

            events.append({
                "title": f"{member.member_name} ({artist_display})",
                "start": birthday.isoformat(),
                "allDay": True,
                # ✅ 프로필 이미지 삽입을 위한 추가 필드
                "member_name": member.member_name,
                "artist_display_name": artist_names[0].display_name if artist_names else ""
            })
        except Exception as e:
            continue

    return JsonResponse(events, safe=False, json_dumps_params={'ensure_ascii': False})
