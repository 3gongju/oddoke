# Generated by Django 5.2.1 on 2025-05-28 06:13

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('artist', '0004_member_followers_alter_artist_followers'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BdayCafe',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cafe_type', models.CharField(choices=[('bday', '생일'), ('debut', '데뷔일'), ('comeback', '컴백'), ('concert', '콘서트'), ('other', '기타')], default='bday', max_length=20, verbose_name='카페 유형')),
                ('cafe_name', models.CharField(max_length=100, verbose_name='카페명')),
                ('address', models.TextField(verbose_name='주소')),
                ('road_address', models.TextField(blank=True, verbose_name='도로명주소')),
                ('detailed_address', models.CharField(blank=True, max_length=200, verbose_name='상세주소')),
                ('kakao_place_id', models.CharField(blank=True, max_length=50, verbose_name='카카오 장소 ID')),
                ('latitude', models.FloatField(verbose_name='위도')),
                ('longitude', models.FloatField(verbose_name='경도')),
                ('phone', models.CharField(blank=True, max_length=20, verbose_name='전화번호')),
                ('place_url', models.URLField(blank=True, verbose_name='카카오맵 장소 URL')),
                ('category_name', models.CharField(blank=True, max_length=100, verbose_name='카테고리')),
                ('start_date', models.DateField(verbose_name='시작일')),
                ('end_date', models.DateField(verbose_name='종료일')),
                ('start_time', models.TimeField(blank=True, null=True, verbose_name='시작시간')),
                ('end_time', models.TimeField(blank=True, null=True, verbose_name='종료시간')),
                ('special_benefits', models.TextField(blank=True, verbose_name='특전 정보')),
                ('event_description', models.TextField(blank=True, verbose_name='이벤트 설명')),
                ('hashtags', models.CharField(blank=True, max_length=500, verbose_name='해시태그')),
                ('main_image', models.ImageField(blank=True, null=True, upload_to='bday_cafes/main/', verbose_name='메인 이미지')),
                ('poster_image', models.ImageField(blank=True, null=True, upload_to='bday_cafes/poster/', verbose_name='포스터 이미지')),
                ('twitter_source', models.URLField(blank=True, verbose_name='트위터 출처')),
                ('instagram_source', models.URLField(blank=True, verbose_name='인스타 출처')),
                ('status', models.CharField(choices=[('pending', '승인 대기'), ('approved', '승인됨'), ('rejected', '거부됨'), ('expired', '만료됨')], default='pending', max_length=20, verbose_name='상태')),
                ('is_featured', models.BooleanField(default=False, verbose_name='추천 생카')),
                ('view_count', models.PositiveIntegerField(default=0, verbose_name='조회수')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='등록일')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='수정일')),
                ('verified_at', models.DateTimeField(blank=True, null=True, verbose_name='승인일')),
                ('artist', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='artist.artist', verbose_name='아티스트')),
                ('member', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='artist.member', verbose_name='멤버')),
                ('submitted_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL, verbose_name='등록자')),
                ('verified_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verified_cafes', to=settings.AUTH_USER_MODEL, verbose_name='승인자')),
            ],
            options={
                'verbose_name': '생일카페',
                'verbose_name_plural': '생일카페들',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CafeFavorite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('cafe', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='ddoksang.bdaycafe')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '생카 찜',
                'verbose_name_plural': '생카 찜 목록',
            },
        ),
        migrations.CreateModel(
            name='TourPlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='투어명')),
                ('tour_date', models.DateField(verbose_name='투어 예정일')),
                ('is_public', models.BooleanField(default=False, verbose_name='공개 여부')),
                ('optimized_route_data', models.JSONField(blank=True, null=True, verbose_name='최적화된 경로 데이터')),
                ('total_distance', models.FloatField(blank=True, null=True, verbose_name='총 거리(km)')),
                ('total_duration', models.IntegerField(blank=True, null=True, verbose_name='총 소요시간(분)')),
                ('transportation_mode', models.CharField(choices=[('TRANSIT', '대중교통'), ('CAR', '자동차'), ('WALK', '도보')], default='TRANSIT', max_length=20, verbose_name='이동수단')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '투어 플랜',
                'verbose_name_plural': '투어 플랜들',
            },
        ),
        migrations.CreateModel(
            name='TourStop',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(verbose_name='순서')),
                ('distance_to_next', models.FloatField(blank=True, null=True, verbose_name='다음 장소까지 거리(km)')),
                ('duration_to_next', models.IntegerField(blank=True, null=True, verbose_name='다음 장소까지 소요시간(분)')),
                ('route_info', models.JSONField(blank=True, null=True, verbose_name='경로 상세 정보')),
                ('estimated_stay_duration', models.IntegerField(default=60, verbose_name='예상 체류 시간(분)')),
                ('notes', models.TextField(blank=True, verbose_name='메모')),
                ('cafe', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='ddoksang.bdaycafe')),
                ('tour', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='ddoksang.tourplan')),
            ],
            options={
                'verbose_name': '투어 경유지',
                'verbose_name_plural': '투어 경유지들',
                'ordering': ['order'],
            },
        ),
        migrations.AddField(
            model_name='tourplan',
            name='cafes',
            field=models.ManyToManyField(through='ddoksang.TourStop', to='ddoksang.bdaycafe'),
        ),
        migrations.CreateModel(
            name='UserSearchHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('search_query', models.CharField(max_length=200, verbose_name='검색어')),
                ('search_type', models.CharField(choices=[('keyword', '키워드'), ('location', '위치'), ('artist', '아티스트')], max_length=20, verbose_name='검색 유형')),
                ('latitude', models.FloatField(blank=True, null=True, verbose_name='검색 위치 위도')),
                ('longitude', models.FloatField(blank=True, null=True, verbose_name='검색 위치 경도')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '검색 기록',
                'verbose_name_plural': '검색 기록들',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='bdaycafe',
            index=models.Index(fields=['latitude', 'longitude'], name='ddoksang_bd_latitud_49833f_idx'),
        ),
        migrations.AddIndex(
            model_name='bdaycafe',
            index=models.Index(fields=['start_date', 'end_date'], name='ddoksang_bd_start_d_acbb1c_idx'),
        ),
        migrations.AddIndex(
            model_name='bdaycafe',
            index=models.Index(fields=['status', 'start_date'], name='ddoksang_bd_status_dfb27d_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='cafefavorite',
            unique_together={('user', 'cafe')},
        ),
        migrations.AlterUniqueTogether(
            name='tourstop',
            unique_together={('tour', 'order')},
        ),
    ]
