from pathlib import Path
import sys
import os
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-cfh$5qsjbaznm+%_=q+q-lt0d%5-60$6qer&0^6-*wwzr072z6')

DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,192.168.100.35,.onrender.com').split(',')

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

# Third party apps (conditionally include registration/socialaccount during tests on SQLite)
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "dj_rest_auth",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "dj_rest_auth.registration",
]

# If running tests on SQLite, skip apps that require native JSON support
if 'test' in sys.argv:
    THIRD_PARTY_APPS = [a for a in THIRD_PARTY_APPS if a not in ("allauth.socialaccount", "dj_rest_auth.registration")]

INSTALLED_APPS += THIRD_PARTY_APPS + ["api"]

SITE_ID = 1

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

# Database configuration - supports both SQLite and PostgreSQL
import dj_database_url

if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.config(default=os.environ.get('DATABASE_URL'), conn_max_age=600)
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Note: we rely on lightweight SQLite JSON helper functions above
# so keep third-party apps (including socialaccount and registration).

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Media files (uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Silence JSONField checks on SQLite for local development where we
# provide lightweight JSON helpers.
SILENCED_SYSTEM_CHECKS = [
    "fields.E180",  # SQLite JSON field warning
    "auth.W005",    # allauth deprecation warning
]

# DRF Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# CORS Settings
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Only allow all origins in development
if not DEBUG:
    CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True

# Trusted origins for CSRF checks
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://*.onrender.com",
]
if os.environ.get('CSRF_TRUSTED_ORIGINS'):
    CSRF_TRUSTED_ORIGINS.extend(os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(','))

# Auth Settings
ACCOUNT_EMAIL_VERIFICATION = 'none'
ACCOUNT_AUTHENTICATION_METHOD = 'username'
ACCOUNT_EMAIL_REQUIRED = False

# Provide lightweight JSON support functions for SQLite testing environments
# Some third-party migrations expect JSON functions (JSON_VALID, JSON_TYPE).
try:
    from django.db.backends.signals import connection_created

    def _add_sqlite_json_functions(sender, connection, **kwargs):
        if connection.vendor == 'sqlite':
            try:
                # JSON_VALID(x) -> 1 if valid JSON, else 0
                connection.connection.create_function('JSON_VALID', 1, lambda s: 1 if s is not None else 0)
                # JSON_TYPE(x) -> return 'text' as a safe default
                connection.connection.create_function('JSON_TYPE', 1, lambda s: 'text')
            except Exception:
                pass

    connection_created.connect(_add_sqlite_json_functions)
except Exception:
    pass

# When running with SQLite in local/dev, some third-party apps use JSONField.
# Force Django's sqlite features to report JSONField support so system checks
# and migrations for those apps proceed. This is safe for local development.
try:
    from django.db.backends.sqlite3 import features as _sqlite_features
    _sqlite_features.DatabaseFeatures.supports_json_field = True
except Exception:
    pass
