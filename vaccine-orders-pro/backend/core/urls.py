from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework.schemas import get_schema_view
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from api.views import FrontendCatchallView
from django.shortcuts import redirect

schema_view = get_schema_view(title="Vaccine Orders API")

urlpatterns = [
    # 🔒 Admin — WITH and WITHOUT slash
    path("admin/", admin.site.urls),
    path("admin", lambda request: redirect("/admin/")),

    # API
    path("api/", include("api.urls")),
    path("api/schema/", schema_view, name="api-schema"),
]

# ✅ React catch-all — SAFE version
urlpatterns += [
    re_path(r"^$", FrontendCatchallView.as_view()),
    re_path(r"^(?!admin|api).+", FrontendCatchallView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    # Quick workaround for Render deployments where DEBUG=False and
    # Django's `static()` helper is disabled. This exposes uploaded media
    # files at `/media/...` so Product images uploaded via admin are
    # reachable. For production, prefer using persistent object storage
    # (S3 or Render persistent disk) and `django-storages` instead.
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
