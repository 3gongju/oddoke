from datetime import timedelta
from django.utils import timezone
from artist.models import Member

def get_weekly_bday_artists():
    today = timezone.now().date()
    today_str = today.strftime('%m-%d')
    upcoming_dates = [(today + timedelta(days=i)).strftime('%m-%d') for i in range(7)]

    members = Member.objects.filter(member_bday__in=upcoming_dates).prefetch_related('artist_name')
    birthday_artists = []

    for member in members:
        artists = member.artist_name.all()
        if not artists:
            continue
        artist = artists[0]
        is_today_birthday = member.member_bday == today_str

        try:
            month, day = map(int, member.member_bday.split('-'))
            this_year_birthday = today.replace(month=month, day=day)
            days_until = (this_year_birthday - today).days if this_year_birthday >= today else (this_year_birthday.replace(year=today.year + 1) - today).days
        except:
            days_until = 999

        display_artist = "" if member.member_name.lower() == artist.display_name.lower() else artist.display_name

        birthday_artists.append({
            'member_name': member.member_name,
            'artist_name': display_artist,
            'artist_display_name': artist.display_name,
            'birthday_display': member.member_bday,
            'profile_image': getattr(member, 'profile_image', None),
            'is_today_birthday': is_today_birthday,
            'days_until_birthday': days_until,
            'member': member,
        })

    birthday_artists.sort(key=lambda x: (not x['is_today_birthday'], x['days_until_birthday'], x['member_name']))
    return birthday_artists
