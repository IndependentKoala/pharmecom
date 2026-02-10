from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework.schemas import get_schema_view
from django.conf import settings
from django.conf.urls.static import static
from api.views import FrontendCatchallView

schema_view = get_schema_view(title="Vaccine Orders API")

schema_view = get_schema_view(title="Vaccine Orders API")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    path("api/schema/", schema_view, name="api-schema"),
]

# React catch-all — exclude admin + api WITH or WITHOUT slash
urlpatterns += [
    re_path(r"^(?!admin$|admin/|api$|api/).*", FrontendCatchallView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

