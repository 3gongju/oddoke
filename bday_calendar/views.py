# bday_calendar/views.py
from datetime import datetime
from django.shortcuts import render
from django.http import JsonResponse
from artist.models import Member

def birthday_calendar(request):
    return render(request, 'bday_calendar/calendar.html')

def birthday_events_api(request):
    members = Member.objects.exclude(member_bday__isnull=True).exclude(member_bday__exact='')
    events = []

    # 🔁 연도 2023~2033년 반복 등록
    for year in range(2023, 2034):
        for m in members:
            mmdd = m.member_bday  # ex: '05-24'
            try:
                date = datetime.strptime(f"{year}-{mmdd}", "%Y-%m-%d")
                artist_names = ', '.join(a.display_name for a in m.artist_name.all())
                events.append({
                    "title": f"{m.member_name} ({artist_names})",
                    "start": date.strftime('%Y-%m-%d')
                })
            except ValueError:
                continue  # '02-30' 같은 잘못된 날짜는 건너뜀

    return JsonResponse(events, safe=False)