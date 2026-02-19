from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.parsers import JSONParser
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import User
from django.db import transaction
from decimal import Decimal
import uuid
from pathlib import Path

from .models import Product, Order, OrderItem, DosePack, UserProfile, Batch, InventoryLog, OrderStatusHistory
from .models import Cart, CartItem
from .serializers import ProductSerializer, OrderSerializer, UserSerializer, BatchSerializer, DosePackSerializer, InventoryLogSerializer, CartSerializer
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.http import JsonResponse

BASE_DIR = Path(__file__).resolve().parent.parent


@api_view(["GET"])
def current_user(request):
    """Return the currently authenticated user (or null).

    For normal users return their `username`. For staff users return
    the existing display name (username) unchanged (admin identity).
    """
    user = request.user if hasattr(request, 'user') else None
    if not user or not user.is_authenticated:
        return Response(None, status=status.HTTP_200_OK)
    serializer = UserSerializer(user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    """Lightweight endpoint to set the CSRF cookie for the frontend.

    Call this with `credentials: 'include'` from the frontend before any
    unsafe POST request so Django sets the CSRF cookie and the request
    can include it automatically.
    """
    token = get_token(request)
    return Response({"detail": "CSRF cookie set", "csrfToken": token})


@api_view(["POST"])
@permission_classes([AllowAny])
def simple_register(request):
    """A lightweight registration endpoint that creates a Django user.

    This avoids relying on the full dj-rest-auth/allauth registration
    endpoints which may be disabled in some local setups.
    """
    data = request.data
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    company_name = data.get('company_name', 'dada').strip()
    password1 = data.get('password1')
    password2 = data.get('password2')

    if not username:
        return Response({'username': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not password1 or not password2:
        return Response({'password': 'Password fields are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if password1 != password2:
        return Response({'password': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({'username': 'A user with that username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
    if email and User.objects.filter(email=email).exists():
        return Response({'email': 'A user with that email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password1)
    # Create user profile with company name
    UserProfile.objects.create(user=user, company_name=company_name)
    serializer = UserSerializer(user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        """Allow GET for everyone, POST/PUT/DELETE for authenticated users"""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class DosePackViewSet(viewsets.ModelViewSet):
    queryset = DosePack.objects.all()
    serializer_class = DosePackSerializer
    permission_classes = [permissions.AllowAny]

    def get_permissions(self):
        """Allow GET for everyone, POST/PUT/DELETE for authenticated users"""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Order.objects.all()
        return Order.objects.filter(user=self.request.user)

    def get_object(self):
        """Override to add object-level permission check."""
        obj = super().get_object()
        # Non-staff users can only access their own orders
        if not self.request.user.is_staff and obj.user != self.request.user:
            self.permission_denied(self.request, message='You do not have permission to access this order.')
        return obj

    def perform_create(self, serializer):
        order = serializer.save(user=self.request.user)
        # Create initial status history record for "requested" status
        OrderStatusHistory.objects.create(
            order=order,
            status=order.status,
            changed_by=None  # System created, no staff member
        )

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        """Staff action to change order status."""
        if not request.user.is_staff:
            return Response({"detail": "Only staff can change order status."}, status=status.HTTP_403_FORBIDDEN)
        
        order = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Order.STATUS_CHOICES):
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        
        # If changing to confirmed, reserve stock for all items in the order.
        # We allocate from batches (FIFO by expiry) and record InventoryLog entries
        # in units (doses * units_per_pack). Use a DB transaction and row locking
        # to avoid race conditions when multiple staff confirm simultaneously.
        if new_status == 'confirmed':
            try:
                with transaction.atomic():
                    for item in order.items.select_related('product', 'dose_pack').all():
                        product = item.product
                        if not product:
                            continue

                        # Determine units per pack (default to 1 if missing)
                        units_per_pack = 1
                        if item.dose_pack:
                            units_per_pack = getattr(item.dose_pack, 'units_per_pack', 1) or 1

                        packs_needed = int(item.quantity or 0)
                        if packs_needed <= 0:
                            continue

                        # Allocate packs from available batches (oldest expiry first)
                        batches_qs = Batch.objects.select_for_update().filter(product=product).order_by('expiry_date')
                        remaining_packs = packs_needed

                        for batch in batches_qs:
                            available_packs = batch.quantity - batch.quantity_reserved
                            if available_packs <= 0:
                                continue
                            take = min(available_packs, remaining_packs)
                            # Reserve these packs
                            batch.quantity_reserved = batch.quantity_reserved + take
                            batch.save()

                            # Log units reserved (packs * units_per_pack)
                            units_reserved = take * int(units_per_pack)
                            InventoryLog.objects.create(
                                product=product,
                                batch=batch,
                                action='reserved',
                                quantity_changed=-units_reserved,
                                reason=f'Confirmed order {order.order_number}',
                                related_order=order,
                                performed_by=request.user
                            )

                            remaining_packs -= take
                            if remaining_packs <= 0:
                                break

                        # If there are remaining packs but no batches exist, deduct from dose pack
                        if remaining_packs > 0:
                            has_dose_packs = product.dose_packs.exists()
                            if not has_dose_packs:
                                # No batches and no dose pack specs - actually insufficient
                                raise Exception(f"Insufficient stock for product {product.id} - needs {packs_needed}, short {remaining_packs}")
                            # Otherwise, dose packs exist but no inventory batches - deduct from dose pack
                            if item.dose_pack:
                                dose_pack = item.dose_pack
                                # Deduct from dose pack units
                                units_to_deduct = remaining_packs  # remaining_packs = packs for this item
                                dose_pack.units_per_pack = max(0, dose_pack.units_per_pack - units_to_deduct)
                                dose_pack.save()
                                
                                # Log the deduction
                                InventoryLog.objects.create(
                                    product=product,
                                    batch=None,
                                    action='confirmed',
                                    quantity_changed=-units_to_deduct,
                                    reason=f'Confirmed order {order.order_number} (no batches, deducted from dose pack)',
                                    related_order=order,
                                    performed_by=request.user
                                )

                        # Keep product.available_stock in sync (sum of units from remaining dose packs)
                        try:
                            # Sum remaining units from dose packs
                            dose_pack_units = sum(dp.units_per_pack for dp in product.dose_packs.all())
                            # Also add available packs from batches
                            batch_packs = sum(b.quantity - b.quantity_reserved for b in Batch.objects.filter(product=product))
                            product.available_stock = int(dose_pack_units + batch_packs)
                            product.save()
                        except Exception:
                            # Non-fatal: if computing available units fails, skip sync
                            pass
            except Exception as e:
                return Response({"detail": f"Error confirming order: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        
        old_status = order.status
        order.status = new_status
        order.save()
        
        # Create a status history record
        OrderStatusHistory.objects.create(
            order=order,
            status=new_status,
            changed_by=request.user
        )
        
        return Response({"detail": "Status updated."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def add_internal_note(self, request, pk=None):
        """Staff action to append internal notes to an order."""
        if not request.user.is_staff:
            return Response({"detail": "Only staff can add internal notes."}, status=status.HTTP_403_FORBIDDEN)
        
        order = self.get_object()
        note = request.data.get('note', '').strip()
        if not note:
            return Response({"detail": "Note is required."}, status=status.HTTP_400_BAD_REQUEST)
        if order.internal_notes:
            order.internal_notes = f"{order.internal_notes}\n{note}"
        else:
            order.internal_notes = note
        order.save()
        return Response({"detail": "Internal note added."}, status=status.HTTP_200_OK)


class BatchViewSet(viewsets.ModelViewSet):
    """ViewSet for managing inventory batches. Staff only."""
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_permissions(self):
        """Only staff can create/update/delete batches"""
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get all batches with low stock or approaching expiry"""
        from datetime import timedelta
        from django.utils import timezone
        
        batches = Batch.objects.filter(
            quantity__lte=100  # Low stock threshold
        ) | Batch.objects.filter(
            expiry_date__lt=timezone.now().date() + timedelta(days=30)  # Approaching expiry
        )
        serializer = self.get_serializer(batches, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_update_stock(self, request):
        """Bulk update stock for multiple batches"""
        if not request.user.is_staff:
            return Response({"detail": "Only staff can update stock."}, status=status.HTTP_403_FORBIDDEN)
        
        updates = request.data.get('updates', [])
        for update in updates:
            try:
                batch = Batch.objects.get(id=update['batch_id'])
                old_quantity = batch.quantity
                batch.quantity = update.get('quantity', batch.quantity)
                batch.storage_location = update.get('storage_location', batch.storage_location)
                batch.save()
                
                # Log the change
                InventoryLog.objects.create(
                    product=batch.product,
                    batch=batch,
                    action='adjusted',
                    quantity_changed=batch.quantity - old_quantity,
                    reason=update.get('reason', 'Bulk adjustment'),
                    performed_by=request.user
                )
            except Batch.DoesNotExist:
                continue
        
        return Response({"detail": f"Updated {len(updates)} batches"})


class InventoryLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing inventory logs. Staff only."""
    serializer_class = InventoryLogSerializer
    permission_classes = [permissions.IsAdminUser]
    
    def get_queryset(self):
        queryset = InventoryLog.objects.all()
        product_id = self.request.query_params.get('product', None)
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return queryset


# Frontend catchall view
from django.views.generic import View
from django.http import HttpResponse, Http404, JsonResponse
import os

class FrontendCatchallView(View):
    """Serve the React frontend's index.html for SPA routing."""
    
    def get(self, request, path=''):
        """Handle GET requests. The 'path' parameter is captured from the URL pattern."""
        
        # Don't serve frontend for API or admin routes
        if request.path.startswith('/api/') or request.path.startswith('/admin/'):
            raise Http404()
        
        # For all other routes, serve index.html for React routing
        index_path = os.path.join(BASE_DIR, 'staticfiles/index.html')
        
        # Fallback to dist folder during development
        if not os.path.exists(index_path):
            index_path = os.path.join(BASE_DIR.parent, 'dist/index.html')
        
        if os.path.exists(index_path):
            try:
                with open(index_path, 'rb') as f:
                    return HttpResponse(f.read(), content_type='text/html')
            except Exception as e:
                return JsonResponse({'error': f'Could not read frontend: {str(e)}'}, status=500)
        
        # If no index.html found, return a 404
        return JsonResponse({'error': f'Frontend not found at {index_path}'}, status=404)


from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated


class CartView(APIView):
    """Endpoint to get or replace the current authenticated user's cart.

    GET: returns the current user's cart (empty list if none or anonymous)
    PUT/POST: replace the user's cart with the provided items (requires auth)
    
    Frontend sends items with nested product/dosePack objects; we extract IDs and save.
    On GET, we return items with full product/dosePack objects.
    """
    def get(self, request):
        user = request.user if hasattr(request, 'user') else None
        if not user or not user.is_authenticated:
            return Response({'items': []}, status=status.HTTP_200_OK)
        cart, _ = Cart.objects.get_or_create(user=user)
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        items = request.data.get('items', [])
        
        # Convert frontend format to backend format
        # Frontend sends: { product: {id, ...}, dosePack: {id, ...}, quantity, ... }
        # We need: { product: id, dose_pack: id, quantity, ... }
        converted_items = []
        for item in items:
            converted = {
                'quantity': item.get('quantity', 1),
                # Accept either snake_case or camelCase from frontend
                'requested_delivery_date': item.get('requested_delivery_date') or item.get('requestedDeliveryDate'),
                'special_instructions': item.get('special_instructions', '') or item.get('specialInstructions', ''),
            }
            # Extract product ID (could be nested object or plain ID)
            product = item.get('product')
            if isinstance(product, dict):
                converted['product'] = product.get('id')
            else:
                converted['product'] = product
            
            # Extract dosePack ID (could be nested object or plain ID)
            dose_pack = item.get('dosePack') or item.get('dose_pack')
            if dose_pack:
                if isinstance(dose_pack, dict):
                    converted['dose_pack'] = dose_pack.get('id')
                else:
                    converted['dose_pack'] = dose_pack
            
            converted_items.append(converted)
        
        cart = CartSerializer().create_or_update_for_user(request.user, converted_items)
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    post = put
