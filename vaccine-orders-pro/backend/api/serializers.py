from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Product, DosePack, Batch, Order, OrderItem, UserProfile, InventoryLog, OrderStatusHistory
from decimal import Decimal
import uuid

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('company_name',)

class UserSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'is_staff', 'is_superuser', 'company_name')
    
    def get_company_name(self, obj):
        """Get company name from profile, or return default 'dada'"""
        try:
            profile = UserProfile.objects.get(user=obj)
            return profile.company_name
        except UserProfile.DoesNotExist:
            return 'dada'

class DosePackSerializer(serializers.ModelSerializer):
    class Meta:
        model = DosePack
        fields = '__all__'

class BatchSerializer(serializers.ModelSerializer):
    available_quantity = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True, use_url=True)

    class Meta:
        model = Batch
        fields = ('id', 'batch_number', 'product', 'expiry_date', 'quantity', 'quantity_reserved', 'available_quantity', 'status', 'storage_location', 'image_url', 'image_alt', 'image', 'created_at', 'updated_at')
    
    def get_available_quantity(self, obj):
        return obj.available_quantity()

class ProductSerializer(serializers.ModelSerializer):
    dose_packs = DosePackSerializer(many=True, read_only=True)
    batches = BatchSerializer(many=True, read_only=True)
    total_stock = serializers.SerializerMethodField()
    total_units = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True, use_url=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'
    
    def get_total_stock(self, obj):
        """Calculate total available stock from all batches"""
        return sum(batch.available_quantity() for batch in obj.batches.all())

    def get_total_units(self, obj):
        """Calculate total units from dose packs (sum of units_per_pack values)."""
        total = 0
        for dp in obj.dose_packs.all():
            try:
                units_per_pack = int(getattr(dp, 'units_per_pack', 0) or 0)
            except Exception:
                units_per_pack = 0
            total += units_per_pack
        return total
    
    def get_image_url(self, obj):
        """Return the appropriate image URL"""
        url = obj.get_image_url()
        request = self.context.get('request') if hasattr(self, 'context') else None
        try:
            if request and url:
                return request.build_absolute_uri(url)
        except Exception:
            pass
        return url

class OrderItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    dose_pack = serializers.PrimaryKeyRelatedField(queryset=DosePack.objects.all(), allow_null=True, required=False)
    batch = serializers.PrimaryKeyRelatedField(queryset=Batch.objects.all(), allow_null=True, required=False)
    product_name = serializers.CharField(read_only=True)
    doses = serializers.IntegerField(read_only=True)
    order = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ('id', 'product', 'dose_pack', 'batch', 'quantity', 'unit_price', 'requested_delivery_date', 'special_instructions', 'product_name', 'doses', 'order')


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusHistory
        fields = ('id', 'status', 'changed_by', 'changed_by_username', 'changed_at')
    
    def get_changed_by_username(self, obj):
        if obj.changed_by:
            return obj.changed_by.username
        return 'System'

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    user = UserSerializer(read_only=True)
    user_company_name = serializers.SerializerMethodField()
    order_number = serializers.CharField(read_only=True)
    total_amount = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2)

    class Meta:
        model = Order
        fields = '__all__'
    
    def get_user_company_name(self, obj):
        """Get company name from user's profile"""
        try:
            profile = UserProfile.objects.get(user=obj.user)
            return profile.company_name
        except UserProfile.DoesNotExist:
            return None

    def validate(self, data):
        items = data.get('items', [])
        if not items or len(items) == 0:
            raise serializers.ValidationError({'items': 'Order must contain at least one item.'})

        for idx, item in enumerate(items):
            # Basic required fields
            if 'product' not in item:
                raise serializers.ValidationError({f'items[{idx}].product': 'This field is required.'})
            if 'quantity' not in item:
                raise serializers.ValidationError({f'items[{idx}].quantity': 'This field is required.'})
            if 'unit_price' not in item:
                raise serializers.ValidationError({f'items[{idx}].unit_price': 'This field is required.'})

            # Validate numeric values
            try:
                quantity = int(item.get('quantity', 0))
            except Exception:
                raise serializers.ValidationError({f'items[{idx}].quantity': 'Invalid integer value.'})
            if quantity <= 0:
                raise serializers.ValidationError({f'items[{idx}].quantity': 'Quantity must be greater than zero.'})

            try:
                unit_price = Decimal(str(item.get('unit_price', '0')))
            except Exception:
                raise serializers.ValidationError({f'items[{idx}].unit_price': 'Invalid decimal value.'})
            if unit_price < 0:
                raise serializers.ValidationError({f'items[{idx}].unit_price': 'Unit price must be non-negative.'})

        return data

    def create(self, validated_data, user=None):
        items_data = validated_data.pop('items', [])
        # prefer explicit user kwarg, fall back to request context
        if user is None:
            user = self.context.get('request').user if self.context.get('request') else None

        # Generate order number
        order_number = f"ORD{uuid.uuid4().hex[:12].upper()}"

        order = Order.objects.create(
            user=user,
            order_number=order_number,
            notes=validated_data.get('notes', ''),
            internal_notes=validated_data.get('internal_notes', ''),
            status=validated_data.get('status', Order.STATUS_CHOICES[0][0]),
            total_amount=Decimal('0.00')
        )

        total = Decimal('0.00')

        for idx, item in enumerate(items_data):
            product = item.get('product')
            dose_pack = item.get('dose_pack', None)
            quantity = int(item.get('quantity', 0))
            unit_price = Decimal(str(item.get('unit_price', '0')))

            # If product is provided as a PK, ensure we fetch instance
            if isinstance(product, int) or isinstance(product, str):
                from .models import Product as ProductModel, DosePack as DosePackModel
                try:
                    product = ProductModel.objects.get(pk=product)
                except ProductModel.DoesNotExist:
                    raise serializers.ValidationError({f'items[{idx}].product': 'Invalid product id'})

            if dose_pack:
                if isinstance(dose_pack, int) or isinstance(dose_pack, str):
                    from .models import DosePack as DosePackModel
                    try:
                        dose_pack = DosePackModel.objects.get(pk=dose_pack)
                    except DosePackModel.DoesNotExist:
                        raise serializers.ValidationError({f'items[{idx}].dose_pack': 'Invalid dose_pack id'})

            order_item = OrderItem.objects.create(
                order=order,
                product=product,
                product_name=getattr(product, 'name', ''),
                dose_pack=dose_pack,
                doses=(dose_pack.doses if dose_pack else 0),
                quantity=quantity,
                unit_price=unit_price,
                requested_delivery_date=item.get('requested_delivery_date'),
                special_instructions=item.get('special_instructions', '')
            )

            total += unit_price * quantity

        order.total_amount = total
        order.save()
        return order


class InventoryLogSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    performed_by_username = serializers.CharField(source='performed_by.username', read_only=True)
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)
    order_number = serializers.CharField(source='related_order.order_number', read_only=True)

    class Meta:
        model = InventoryLog
        fields = ('id', 'product', 'product_name', 'batch', 'batch_number', 'action', 'quantity_changed', 'reason', 'related_order', 'order_number', 'performed_by', 'performed_by_username', 'created_at')
