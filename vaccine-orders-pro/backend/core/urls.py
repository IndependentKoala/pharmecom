from django.contrib import admin
from django.urls import path, include
from rest_framework.schemas import get_schema_view
from django.conf import settings
from django.conf.urls.static import static
from api.views import FrontendCatchallView

schema_view = get_schema_view(title="Vaccine Orders API")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/schema/', schema_view, name='api-schema'),
    # Catchall route - must be last to serve React frontend
    path('', FrontendCatchallView.as_view()),
    path('<path:path>', FrontendCatchallView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
