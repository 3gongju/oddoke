# bday_calendar/views.py
from datetime import date
from django.shortcuts import render
from django.http import JsonResponse
from artist.models import Member
from artist.templatetags.member_images import member_image

def birthday_calendar(request):
    all_members = Member.objects.select_related().all()
    return render(request, 'bday_calendar/calendar.html', {
        'all_members': all_members
    })

def birthday_events_api(request):
    today = date.today()
    current_year = today.year

    members = Member.objects.exclude(
        member_bday__isnull=True
    ).exclude(
        member_bday__exact=''
    ).prefetch_related('artist_name')

    events = []
    unique_members = {}  # 멤버명을 키로 하는 딕셔너리로 중복 제거
    
    for member in members:
        try:
            mm, dd = map(int, member.member_bday.strip().split('-'))
            birthday = date(current_year, mm, dd)

            # 이미 처리된 멤버인지 확인
            if member.member_name in unique_members:
                # 기존 멤버의 아티스트 목록에 추가
                existing_artists = unique_members[member.member_name]['artist_names']
                new_artists = member.artist_name.all()
                for artist in new_artists:
                    if artist not in existing_artists:
                        existing_artists.append(artist)
                continue

            artist_names = list(member.artist_name.all())
            first_artist_display = artist_names[0].display_name if artist_names else ""

            # 멤버 정보 저장
            unique_members[member.member_name] = {
                'member': member,
                'birthday': birthday,
                'artist_names': artist_names,
                'first_artist_display': first_artist_display
            }

        except Exception as e:
            continue

    # 고유한 멤버들로 이벤트 생성
    for member_name, data in unique_members.items():
        artist_display = ', '.join([a.display_name for a in data['artist_names']]) if data['artist_names'] else "Unknown"
        
        # 멤버 이미지 URL 생성
        image_url = member_image(member_name, data['first_artist_display'])

        events.append({
            "title": f"{member_name} ({artist_display})",
            "start": data['birthday'].isoformat(),
            "allDay": True,
            "member_name": member_name,
            "artist_display_name": data['first_artist_display'],
            "image_url": image_url
        })

    return JsonResponse(events, safe=False, json_dumps_params={'ensure_ascii': False})