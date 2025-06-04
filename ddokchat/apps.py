from django.apps import AppConfig


class DdokchatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ddokchat'

    def ready(self):
        import ddokchat.signals