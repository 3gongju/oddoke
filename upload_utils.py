# upload_utils.py (프로젝트 루트에 생성)
import os
from datetime import datetime

def upload_path(folder_name):
    """가장 간단한 업로드 경로 (원본 파일명 사용)"""
    def get_path(instance, filename):
        now = datetime.now()
        return os.path.join(folder_name, now.strftime('%y/%m'), filename)
    return get_path

# 앱별 이미지 업로드 함수들
ddokdam_image_upload = upload_path('ddokdam/images')
ddokfarm_image_upload = upload_path('ddokfarm/images')
# ddoksang_image_upload = upload_path('ddoksang/images')
ddokchat_image_upload = upload_path('ddokchat/images')

# accounts 앱 관련 (accounts/ 접두사 사용)
profile_image_upload = upload_path('accounts/profile')
banner_image_upload = upload_path('accounts/banners')
fandom_card_upload = upload_path('accounts/fandom_cards')