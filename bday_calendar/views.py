# bday_calendar/views.py
from datetime import datetime, timedelta
from django.shortcuts import render
from django.http import JsonResponse
from artist.models import Member
from datetime import date

def birthday_calendar(request):
    return render(request, 'bday_calendar/calendar.html')

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
                "allDay": True
            })
        except Exception as e:
            continue

    return JsonResponse(events, safe=False, json_dumps_params={'ensure_ascii': False})