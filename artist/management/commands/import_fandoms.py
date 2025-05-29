import csv
import os
from django.core.management.base import BaseCommand
from artist.models import Artist

class Command(BaseCommand):
    help = "Import fandoms from CSV"

    def handle(self, *args, **kwargs):
        # ✅ 현재 위치에서 BASE_DIR 기준 경로로 변경
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        csv_path = os.path.join(base_dir, 'fandom.csv')  # ⬅️ 정확한 파일명으로 수정

        updated = 0
        with open(csv_path, encoding='utf-8-sig') as f:  # BOM 처리용 utf-8-sig
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    artist = Artist.objects.get(id=row['id'].strip())
                    artist.fandom = row['fandom'].strip()
                    artist.save()
                    updated += 1
                    self.stdout.write(f"✅ {artist.display_name} → {artist.fandom}")
                except Artist.DoesNotExist:
                    self.stdout.write(f"❌ ID {row['id']} 아티스트 없음")
                except KeyError as e:
                    self.stdout.write(f"❗ CSV 열이 잘못되었습니다. 누락된 키: {e}")

        self.stdout.write(self.style.SUCCESS(f"{updated}개 아티스트의 팬덤명이 업데이트되었습니다."))
