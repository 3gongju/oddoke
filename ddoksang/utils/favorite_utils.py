from ddoksang.models import CafeFavorite


def get_user_favorites(user):
    """현재 로그인한 유저의 찜한 카페 ID 목록"""
    if user.is_authenticated:
        return set(CafeFavorite.objects.filter(user=user).values_list("cafe_id", flat=True))
    return set()
