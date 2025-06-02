from django.urls import path
from .views import faq_chat_api, faq_test_page

urlpatterns = [
    path("api/faq_chat/", faq_chat_api, name="faq_chat_api"),
    path("test/", faq_test_page, name="faq_test_page"),
]