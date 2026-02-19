import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, Calendar, ArrowRight } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useCart } from '@/context/CartContext';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { format, addDays } from 'date-fns';

export default function Cart() {
  const { items, removeItem, updateQuantity, updateDeliveryDate, updateSpecialInstructions, clearCart } = useCart();
  const navigate = useNavigate();

  const handleCheckout = async () => {
    // Require authentication before submitting an order
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const userRes = await fetch('/api/auth/user/', { 
        headers: { 'Authorization': `Token ${token}` }
      });
      if (!userRes.ok) {
        localStorage.removeItem('authToken');
        navigate('/');
        return;
      }
      const userData = await userRes.json().catch(() => null);
      if (!userData) {
        localStorage.removeItem('authToken');
        navigate('/');
        return;
      }
    } catch (e) {
      console.warn('Auth check failed', e);
      navigate('/');
      return;
    }

    // build payload
    const payload = {
      notes: 'Order placed from storefront',
      items: items.map(i => ({
        product: parseInt(i.product.id, 10) || i.product.id,
        dose_pack: typeof i.dosePack.id === 'string' ? parseInt(i.dosePack.id, 10) : i.dosePack.id,
        quantity: i.quantity,
        unit_price: '0.00',
        requested_delivery_date: i.requestedDeliveryDate,
        special_instructions: i.specialInstructions || '',
      })),
    };

    try {
      await api.createOrder(payload);
      toast({ title: 'Order Request Submitted', description: "Your order has been submitted for review." });
      clearCart();
    } catch (err: any) {
      console.error('Order creation failed', err);
      if (err && err.status === 401) {
        // If backend still responds 401, redirect to sign-in
        toast({ title: 'Not authenticated', description: 'Please sign in to place orders.' });
        navigate('/');
      } else if (err && err.data) {
        toast({ title: 'Order failed', description: JSON.stringify(err.data) });
      } else {
        toast({ title: 'Order failed', description: 'An unexpected error occurred.' });
      }
    }
  };

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container-main py-16 text-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">Your Cart is Empty</h1>
          <p className="text-muted-foreground mb-6">
            Add some vaccines to your cart to place an order request.
          </p>
          <Link to="/catalog">
            <Button variant="hero">
              Browse Catalog
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-main py-8 lg:py-12">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-8">
          Shopping Cart
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={`${item.product.id}-${item.dosePack.id}`} className="animate-fade-in">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Product Image placeholder */}
                    <div className="w-full sm:w-24 h-24 rounded-lg bg-gradient-to-br from-muted to-secondary flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{item.product.brand}</p>
                          <h3 className="font-heading font-semibold text-foreground">
                            {item.product.name}
                          </h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.product.id, item.dosePack.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {item.dosePack.doses.toLocaleString()} doses
                        </Badge>
                        <Badge variant={item.product.species}>
                          {item.product.species}
                        </Badge>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        {/* Quantity */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product.id, item.dosePack.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product.id, item.dosePack.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Delivery Date */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Calendar className="h-4 w-4" />
                              {(() => {
                                try {
                                  return format(new Date(item.requestedDeliveryDate), 'MMM d, yyyy');
                                } catch (e) {
                                  return 'Select date';
                                }
                              })()}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent
                              mode="single"
                              selected={(() => {
                                try {
                                  return new Date(item.requestedDeliveryDate);
                                } catch (e) {
                                  return new Date();
                                }
                              })()}
                              onSelect={(date) => date && updateDeliveryDate(
                                item.product.id, 
                                item.dosePack.id, 
                                format(date, 'yyyy-MM-dd')
                              )}
                              disabled={(date) => date < addDays(new Date(), item.product.leadTimeDays)}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Special Instructions */}
                      <div className="pt-3">
                        <label className="text-xs text-muted-foreground font-medium mb-1 block">
                          Special Instructions (Optional)
                        </label>
                        <textarea
                          value={item.specialInstructions || ''}
                          onChange={(e) => updateSpecialInstructions(
                            item.product.id, 
                            item.dosePack.id, 
                            e.target.value
                          )}
                          placeholder="Add any special requests or notes for this item..."
                          className="w-full p-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={`${item.product.id}-${item.dosePack.id}`} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.product.name}
                      </span>
                      <span>{item.quantity} × {item.dosePack.doses.toLocaleString()} doses</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {items.length} item{items.length !== 1 ? 's' : ''} in cart
                  </p>
                </div>

                <Button 
                  variant="hero" 
                  className="w-full"
                  onClick={handleCheckout}
                >
                  Submit Order Request
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  This is an order request, not a purchase. 
                  Our team will confirm your order and schedule delivery.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
