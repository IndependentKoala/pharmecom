from django.contrib import admin
from .models import Product, DosePack, Batch, Order, OrderItem, OrderStatusHistory, UserProfile

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'brand', 'species', 'product_type', 'available_stock', 'created_at')
    list_filter = ('species', 'product_type', 'brand', 'created_at')
    search_fields = ('name', 'brand', 'manufacturer', 'description')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'brand', 'manufacturer', 'description')
        }),
        ('Classification', {
            'fields': ('species', 'product_type', 'image_url', 'image_alt')
        }),
        ('Technical Details', {
            'fields': ('active_ingredients', 'cold_chain_required', 'storage_temp_range', 'administration_notes')
        }),
        ('Inventory & Logistics', {
            'fields': ('available_stock', 'minimum_order_qty', 'lead_time_days')
        }),
        ('Metadata', {
            'fields': ('tags', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(DosePack)
class DosePackAdmin(admin.ModelAdmin):
    list_display = ('product', 'doses', 'units_per_pack')
    list_filter = ('doses', 'product')
    search_fields = ('product__name',)

@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):
    list_display = ('product', 'batch_number', 'expiry_date', 'quantity', 'image_preview')
    list_filter = ('product', 'expiry_date')
    search_fields = ('batch_number', 'product__name')
    readonly_fields = ('created_at',) if hasattr(Batch, 'created_at') else ()
    fieldsets = (
        (None, {
            'fields': ('product', 'batch_number', 'expiry_date', 'quantity', 'quantity_reserved', 'status', 'storage_location', 'image_url', 'image_alt')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    def image_preview(self, obj):
        if getattr(obj, 'image', None):
            return f"<img src='{obj.image.url}' style='height:40px;'/>"
        if obj.image_url:
            return f"<img src='{obj.image_url}' style='height:40px;'/>"
        return '-'
    image_preview.allow_tags = True
    image_preview.short_description = 'Image'


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'company_name', 'created_at', 'updated_at')
    search_fields = ('user__username', 'company_name')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'user', 'status', 'total_amount', 'created_at')
    list_filter = ('status', 'created_at', 'user')
    search_fields = ('order_number', 'user__username')
    readonly_fields = ('order_number', 'created_at', 'updated_at')
    fieldsets = (
        ('Order Information', {
            'fields': ('order_number', 'user', 'status')
        }),
        ('Amount', {
            'fields': ('total_amount',)
        }),
        ('Notes', {
            'fields': ('notes', 'internal_notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product_name', 'quantity', 'unit_price')
    list_filter = ('order__created_at', 'order__status')
    search_fields = ('product_name', 'order__order_number')
    readonly_fields = ('order',)

@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('order', 'status', 'changed_by', 'changed_at')
    list_filter = ('status', 'changed_at')
    search_fields = ('order__order_number', 'changed_by__username')
    readonly_fields = ('order', 'status', 'changed_by', 'changed_at')
