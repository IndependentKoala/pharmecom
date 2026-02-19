from django.urls import path, include
from django.conf import settings
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, OrderViewSet, BatchViewSet, DosePackViewSet, InventoryLogViewSet, simple_register
from .views import current_user
from .views import csrf
from .views import CartView

router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'batches', BatchViewSet)
router.register(r'dosepacks', DosePackViewSet)
router.register(r'inventory-logs', InventoryLogViewSet, basename='inventory-log')

urlpatterns = [
    path('auth/user/', current_user),
    path('auth/csrf/', csrf),
    path('auth/', include('dj_rest_auth.urls')),
    path('auth/register/', simple_register),
    path('', include(router.urls)),
    path('cart/', CartView.as_view()),
]

if 'dj_rest_auth.registration' in getattr(settings, 'INSTALLED_APPS', []):
    urlpatterns.append(path('auth/registration/', include('dj_rest_auth.registration.urls')))
