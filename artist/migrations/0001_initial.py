from django.db import migrations, models

class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Artist',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('display_name', models.CharField(max_length=100, unique=True, help_text='유저에게 보여줄 대표 이름')),
                ('is_active', models.BooleanField(default=True)),  # 혹은 필요에 따라 필드를 수정하세요
            ],
        ),
        migrations.CreateModel(
            name='Member',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('member_name', models.CharField(max_length=100)),
                ('member_bday', models.CharField(max_length=10, blank=True, null=True)),
            ],
        ),
        migrations.AddField(
            model_name='member',
            name='artist_name',
            field=models.ManyToManyField(related_name='members', to='artist.Artist'),
        ),
    ]
