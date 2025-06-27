# 나무위키로 수집한 멤버 프로필 이미지를 처리하는 Django 템플릿 태그
import os
from django import template
from django.templatetags.static import static
from django.conf import settings

register = template.Library()

def check_file_exists(image_path):
    """개발/배포 환경에 따라 파일 존재 여부 확인"""
    if settings.DEBUG and settings.STATICFILES_DIRS:
        # 개발 환경: STATICFILES_DIRS에서 확인
        full_path = os.path.join(settings.STATICFILES_DIRS[0], image_path)
        return os.path.exists(full_path)
    else:
        # 배포 환경: STATIC_ROOT에서 확인
        if hasattr(settings, 'STATIC_ROOT') and settings.STATIC_ROOT:
            full_path = os.path.join(settings.STATIC_ROOT, image_path)
            return os.path.exists(full_path)
    return False

@register.simple_tag
def member_image(member_name, artist_display_name=None):
    """
    멤버명과 아티스트명을 받아서 해당하는 프로필 이미지 URL을 반환합니다.
    파일명 형식: 아티스트displayname_멤버명.jpg
    예: {% member_image "니콜라스" "&TEAM" %} → /static/image/member_namu_images/&TEAM_니콜라스.jpg
    """
    if not member_name:
        return static('image/default_member.svg')
    
    # 지원하는 이미지 확장자
    extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    
    # 아티스트명이 제공된 경우 해당 아티스트의 이미지를 찾기
    if artist_display_name:
        for ext in extensions:
            image_path = f'image/member_namu_images/{artist_display_name}_{member_name}{ext}'
            if check_file_exists(image_path):
                return static(image_path)
    
    # 아티스트명이 없거나 위에서 찾지 못한 경우, 모든 가능한 조합 시도
    # 일반적인 아티스트 이름들로 시도
    common_artists = ['&TEAM', 'STURN', 'BTS', 'BLACKPINK', 'NewJeans', 'IVE', 'aespa']
    
    for artist in common_artists:
        for ext in extensions:
            image_path = f'image/member_namu_images/{artist}_{member_name}{ext}'
            if check_file_exists(image_path):
                return static(image_path)
    
    # 그래도 없으면 패턴 매칭으로 찾기
    import glob
    
    if settings.DEBUG and settings.STATICFILES_DIRS:
        namu_dir = os.path.join(settings.STATICFILES_DIRS[0], 'image/member_namu_images')
    elif hasattr(settings, 'STATIC_ROOT') and settings.STATIC_ROOT:
        namu_dir = os.path.join(settings.STATIC_ROOT, 'image/member_namu_images')
    else:
        return static('image/default_member.svg')
    
    for ext in extensions:
        # *_멤버명.jpg 패턴으로 검색
        pattern = os.path.join(namu_dir, f'*_{member_name}{ext}')
        matches = glob.glob(pattern)
        
        if matches:
            # 첫 번째 매치된 파일 사용
            if settings.DEBUG and settings.STATICFILES_DIRS:
                relative_path = os.path.relpath(matches[0], settings.STATICFILES_DIRS[0]).replace('\\', '/')
            else:
                relative_path = os.path.relpath(matches[0], settings.STATIC_ROOT).replace('\\', '/')
            return static(relative_path)
    
    # 이미지가 없으면 기본 아바타 반환
    return static('image/default_member.svg')

@register.simple_tag
def member_image_from_obj(member_obj):
    """
    Member 객체를 받아서 프로필 이미지 URL을 반환합니다.
    첫 번째 아티스트의 이미지를 사용합니다.
    예: {% member_image_from_obj member %}
    """
    if not member_obj or not member_obj.member_name:
        return static('image/default_member.svg')
    
    # 첫 번째 아티스트 사용
    first_artist = member_obj.artist_name.first()
    if first_artist:
        return member_image(member_obj.member_name, first_artist.display_name)
    else:
        return member_image(member_obj.member_name)

@register.filter
def member_has_image(member_name, artist_display_name=None):
    """
    멤버에게 프로필 이미지가 있는지 확인하는 필터
    예: {% if "니콜라스"|member_has_image:"&TEAM" %}
    """
    if not member_name:
        return False
    
    extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    
    # 아티스트명이 제공된 경우
    if artist_display_name:
        for ext in extensions:
            image_path = f'image/member_namu_images/{artist_display_name}_{member_name}{ext}'
            if check_file_exists(image_path):
                return True
    
    # 패턴 매칭으로 찾기
    import glob
    
    if settings.DEBUG and settings.STATICFILES_DIRS:
        namu_dir = os.path.join(settings.STATICFILES_DIRS[0], 'image/member_namu_images')
    elif hasattr(settings, 'STATIC_ROOT') and settings.STATIC_ROOT:
        namu_dir = os.path.join(settings.STATIC_ROOT, 'image/member_namu_images')
    else:
        return False
    
    for ext in extensions:
        pattern = os.path.join(namu_dir, f'*_{member_name}{ext}')
        matches = glob.glob(pattern)
        if matches:
            return True
    
    return False