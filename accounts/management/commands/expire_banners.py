# accounts/management/commands/expire_banners.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import BannerRequest

class Command(BaseCommand):
    help = '만료된 배너들을 자동으로 정리합니다'

    def handle(self, *args, **options):
        expired_banners = BannerRequest.objects.filter(
            status='approved',
            expires_at__lt=timezone.now()
        )
        
        expired_count = expired_banners.count()
        expired_banners.update(status='expired')
        
        self.stdout.write(
            self.style.SUCCESS(f'{expired_count}개의 만료된 배너를 정리했습니다.')
        )