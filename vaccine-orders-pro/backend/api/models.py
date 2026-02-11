from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    company_name = models.CharField(max_length=255, default='dada')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.company_name}"

class Product(models.Model):
    SPECIES_CHOICES = [
        ('poultry', 'Poultry'),
        ('swine', 'Swine'),
    ]
    TYPE_CHOICES = [
        ('live', 'Live'),
        ('killed', 'Killed'),
        ('attenuated', 'Attenuated'),
    ]

    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=255)
    species = models.CharField(max_length=10, choices=SPECIES_CHOICES)
    product_type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    manufacturer = models.CharField(max_length=255)
    description = models.TextField()
    active_ingredients = models.TextField()
    cold_chain_required = models.BooleanField(default=True)
    storage_temp_range = models.CharField(max_length=50)
    image = models.ImageField(upload_to='products/', null=True, blank=True)
    image_url = models.CharField(max_length=255, default='/placeholder.svg', blank=True)
    image_alt = models.CharField(max_length=255, blank=True, default='')
    tags = models.TextField(default="[]")  # Store as JSON string
    minimum_order_qty = models.IntegerField(default=1)
    lead_time_days = models.IntegerField(default=3)
    available_stock = models.IntegerField(default=0)
    administration_notes = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def get_image_url(self):
        """Return the image URL, preferring uploaded image over image_url field"""
        if self.image and self.image.name:
            return self.image.url
        return self.image_url or '/placeholder.svg'

class DosePack(models.Model):
    product = models.ForeignKey(Product, related_name='dose_packs', on_delete=models.CASCADE)
    doses = models.IntegerField()
    units_per_pack = models.IntegerField()

    def __str__(self):
        return f"{self.doses} doses - {self.product.name}"

class Batch(models.Model):
    BATCH_STATUS_CHOICES = [
        ('available', 'Available'),
        ('reserved', 'Reserved'),
        ('shipped', 'Shipped'),
        ('expired', 'Expired'),
    ]
    
    product = models.ForeignKey(Product, related_name='batches', on_delete=models.CASCADE)
    batch_number = models.CharField(max_length=50, unique=True)
    expiry_date = models.DateField()
    quantity = models.IntegerField()
    quantity_reserved = models.IntegerField(default=0)
    status = models.CharField(max_length=15, choices=BATCH_STATUS_CHOICES, default='available')
    storage_location = models.CharField(max_length=100, blank=True)
    # Optional image for the batch (falls back to product image)
    image_url = models.CharField(max_length=255, default='', blank=True)
    image_alt = models.CharField(max_length=255, blank=True)
    # Uploaded image file for the batch
    image = models.ImageField(upload_to='batches/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['expiry_date']

    def available_quantity(self):
        return self.quantity - self.quantity_reserved

    def __str__(self):
        return f"{self.batch_number} - {self.product.name}"

class Order(models.Model):
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('confirmed', 'Confirmed'),
        ('prepared', 'Prepared'),
        ('dispatched', 'Dispatched'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    order_number = models.CharField(max_length=20, unique=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='requested')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True, null=True)
    internal_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.order_number

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=255) # Snapshot of product name
    dose_pack = models.ForeignKey(DosePack, on_delete=models.SET_NULL, null=True)
    doses = models.IntegerField() # Snapshot
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    requested_delivery_date = models.DateField()
    special_instructions = models.TextField(blank=True, null=True)
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_items')

    def __str__(self):
        return f"{self.product_name} x {self.quantity} in {self.order.order_number}"


class InventoryLog(models.Model):
    LOG_ACTION_CHOICES = [
        ('received', 'Stock Received'),
        ('reserved', 'Reserved for Order'),
        ('shipped', 'Shipped'),
        ('returned', 'Returned'),
        ('expired', 'Expired'),
        ('adjusted', 'Manual Adjustment'),
    ]
    
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='inventory_logs')
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=LOG_ACTION_CHOICES)
    quantity_changed = models.IntegerField()
    reason = models.TextField(blank=True)
    related_order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name} - {self.action} ({self.quantity_changed})"


class OrderStatusHistory(models.Model):
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('confirmed', 'Confirmed'),
        ('prepared', 'Prepared'),
        ('dispatched', 'Dispatched'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['changed_at']
        verbose_name_plural = 'Order Status Histories'

    def __str__(self):
        return f"{self.order.order_number} - {self.status} by {self.changed_by.username if self.changed_by else 'System'}"
