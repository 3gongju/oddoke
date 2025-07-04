"""
Django settings for oddoke project.

Generated by 'django-admin startproject' using Django 5.2.1.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.2/ref/settings/
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ✅ .env 파일 명시적으로 로드 (개선)
env_path = BASE_DIR / '.env'
load_dotenv(env_path, override=True)

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-2*cvgp4g-ut870+fv-u#9v*#lr$#$7ip&h=4yjc-k&)g3s(5g2'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'

# ALLOWED_HOSTS = []
ALLOWED_HOSTS = [
    '127.0.0.1',
    'localhost',
    '.compute.amazonaws.com',
    'oddoke.com',
    'www.oddoke.com',
    '13.125.119.122',
    ]

# HTTPS 관련 설정
if DEBUG:
    SECURE_SSL_REDIRECT = False
else:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True


# Application definition

INSTALLED_APPS = [
    "daphne",
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    
    'ddokfarm',
    'ddokdam',
    'accounts',
    'artist',
    'bday_calendar',
    'ddoksang',
    'ddokchat',
    'notifications',
    'faq',
    'oddmin',

    'widget_tweaks',
    'import_export',
    'django_browser_reload',
    'channels',
    'storages', 
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'accounts.middleware.SuspensionCheckMiddleware',  # 제재 확인 미들웨어 추가
]

ROOT_URLCONF = 'oddoke.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'oddoke.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

if DEBUG:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME' : 'oddoke',
            'USER' : os.getenv('RDS_USERNAME'),
            'PASSWORD' : os.getenv('RDS_PASSWORD'),
            'HOST': os.getenv('RDS_HOST'),
            'PORT': '3306',
        }
    }

# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LOGIN_REDIRECT_URL = '/'#로그인 시 home.html로 리다이렉트
LOGOUT_REDIRECT_URL = '/' #로그아웃 시 home.html로 리다이렉트


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'ko-kr'

TIME_ZONE = 'Asia/Seoul'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

STATIC_ROOT = BASE_DIR / 'collectstatic'

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# s3 설정
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = 'oddoke-bucket'
AWS_S3_REGION_NAME = 'ap-northeast-2'

# 표준 S3 엔드포인트 사용
AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com'

# 기타 설정
# AWS_DEFAULT_ACL = 'public-read'
AWS_DEFAULT_ACL = None  # ACL 사용 안 함
AWS_S3_FILE_OVERWRITE = False
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}

if DEBUG:
    # 개발 환경: 로컬 저장
    MEDIA_ROOT = BASE_DIR / 'media'
    MEDIA_URL = '/media/'
else:
    # 운영 환경: S3 저장
    # DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        }
    }
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'


AUTH_USER_MODEL = 'accounts.User'

# 이메일 가입
AUTHENTICATION_BACKENDS = [
    'accounts.backends.EmailBackend',
]

# 메일 서버 설정
# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
# EMAIL_HOST = 'smtp.gmail.com'
# EMAIL_PORT = 587
# EMAIL_USE_TLS = True
# EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
# EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
# DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)

# 비밀번호 재설정 관련 설정
PASSWORD_RESET_TIMEOUT = 86400  # 24시간 (초 단위)


# TAILWIND_APP_NAME = 'theme'

# 카카오맵 API 키 설정
KAKAO_MAP_API_KEY = os.getenv('KAKAO_MAP_API_KEY')
KAKAO_REST_API_KEY = os.getenv('KAKAO_REST_API_KEY') 

KAKAO_API_KEY = KAKAO_MAP_API_KEY

# 카카오톡 공유하기 키 설정
KAKAO_JAVASCRIPT_KEY = os.getenv('KAKAO_JAVASCRIPT_KEY')

# 구글 OAuth 설정
GOOGLE_OAUTH_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID')
GOOGLE_OAUTH_SECRET_ID = os.getenv('GOOGLE_OAUTH_SECRET_ID')
GOOGLE_OAUTH_REDIRECT_URI = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')
GOOGLE_OAUTH_LOGOUT_REDIRECT_URI = os.getenv('GOOGLE_OAUTH_LOGOUT_REDIRECT_URI')
GOOGLE_OAUTH_JAVASCRIPT_ORIGIN = os.getenv('GOOGLE_OAUTH_JAVASCRIPT_ORIGIN')


# 실시간 채팅 기능(WebSocket) 쓰기 위한 설정
ASGI_APPLICATION = 'oddoke.asgi.application'

# Redis 설정
REDIS_URL = os.getenv('REDIS_URL')

# 채널 레이어 설정
# CHANNEL_LAYERS = {
#     'default': {
#         'BACKEND': 'channels.layers.InMemoryChannelLayer',  # 개발용: 메모리 기반
#     },
# }
if DEBUG:
    # 개발환경: InMemory (로컬에서만)
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }
else:
    # 🔥 운영환경: Redis 채널 레이어 (필수!)
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                "hosts": [
                    os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
                ],
                "capacity": 300,
                "expiry": 10,
            },
        },
    }




# 오픈 API 키 설정
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# settings.py에 추가
NEARBY_CAFE_RADIUS = 5  # km
WALKING_SPEED_KMPH = 5  # km/h
DEFAULT_PAGE_SIZE = 10
MAX_NEARBY_CAFES = 50
WALKING_SPEED_KMPH = 5   # 도보 속도 (km/h)

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
        'TIMEOUT': 300,  # 5분
        'OPTIONS': {
            'MAX_ENTRIES': 1000,
        }
    }
}


# 더치트 API 설정
DUTCHEAT_API_KEY = os.getenv('DUTCHEAT_API_KEY', 'test_api_key')
DUTCHEAT_API_URL = os.getenv('DUTCHEAT_API_URL', 'https://api.dutcheat.com')

# Mock 서비스 사용 여부 (개발/테스트용)
USE_MOCK_BANK_SERVICE = True  # 실제 운영시에는 False로 변경

# 암호화 키 설정
ACCOUNT_ENCRYPTION_KEY = os.getenv('ACCOUNT_ENCRYPTION_KEY')

if not ACCOUNT_ENCRYPTION_KEY:
    raise ValueError("ACCOUNT_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.")


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'django.log'),
            'formatter': 'verbose',
        },
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'ddoksang': {
            'handlers': ['file', 'console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# logs 디렉토리 생성
os.makedirs(os.path.join(BASE_DIR, 'logs'), exist_ok=True)


# 나중에 실제 API 사용시 설정
# REAL_BANK_API_KEY = 'your_api_key_here'
# USE_MOCK_BANK_SERVICE = False


# 배너 일자, 포인트 설정 변경시
BANNER_DISPLAY_DAYS = 3
BANNER_COST_POINTS = 1000


# 혹은 최대 배너수도 설정 가능 일단은 주석
# BANNER_CONFIG = {
#     'DISPLAY_DAYS': 3,
#     'COST_POINTS': 1000,
#     'MAX_ACTIVE_BANNERS': 10,  # 동시에 활성화될 수 있는 최대 배너 수
# }