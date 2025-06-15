# 모든 뷰 함수들을 한 곳에서 import

from .base_views import (
    home_view,
    cafe_detail_view,
    search_view,
    map_view,
    # cafe_list_view,
)

from .cafe_views import (
    cafe_create_view,
    cafe_create_success,
    my_cafes,
    toggle_favorite as toggle_favorite_view,
    favorites_view as my_favorites_view,
    user_preview_cafe,
    cafe_image_upload_view,
    cafe_image_delete_view,
    cafe_edit_view,
)

from .api_views import (
    cafe_quick_view,
    bday_cafe_list_api,
    nearby_cafes_api,
    cafe_map_data_api,
    search_suggestions_api,
)

from .admin_views import (
    admin_dashboard as admin_dashboard_view,
    admin_cafe_list,
    approve_cafe,
    reject_cafe,
    admin_preview_cafe,
)

# 하위 호환성을 위한 별칭들

bday_cafe_detail = cafe_detail_view
toggle_favorite = toggle_favorite_view
admin_dashboard = admin_dashboard_view
cafe_list_api = bday_cafe_list_api # API 엔드포인트 이름 변경