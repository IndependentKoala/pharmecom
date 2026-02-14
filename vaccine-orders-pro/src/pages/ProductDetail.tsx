import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Snowflake, Package, AlertTriangle, Plus, Minus, Calendar } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCart } from '@/context/CartContext';
import { toast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface Product {
  id: number;
  name: string;
  brand: string;
  species: string;
  description: string;
  type: string;
  product_type: string;
  manufacturer?: string;
  activeIngredients: string;
  administrationNotes?: string;
  coldChainRequired: boolean;
  storageTempRange: string;
  minimumOrderQty: number;
  leadTimeDays: number;
  availableStock: number;
  image?: string;
  image_url?: string;
  image_alt?: string;
  dose_packs?: Array<{
    id: number;
    doses: number;
    units_per_pack: number;
  }>;
  dosePacks?: Array<{
    id: number | string;
    doses: number;
    units_per_pack: number;
  }>;
  batches?: Array<{
    id: number;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    available_quantity: number;
  }>;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`/api/products/${id}/`, {
          credentials: 'include',
          headers: token ? { 'Authorization': `Token ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          // Transform API response to match our format
          const transformedProduct: Product = {
            ...data,
            type: data.product_type,
            activeIngredients: data.active_ingredients,
            administrationNotes: data.administration_notes,
            coldChainRequired: data.cold_chain_required,
            storageTempRange: data.storage_temp_range,
            minimumOrderQty: data.minimum_order_qty,
            leadTimeDays: data.lead_time_days,
            availableStock: data.available_stock,
            dosePacks: data.dose_packs || []
          };
          setProduct(transformedProduct);
        } else {
          console.error('Failed to fetch product:', res.status);
          setProduct(null);
        }
      } catch (err) {
        console.error('Failed to fetch product:', err);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/auth/user/', {
          credentials: 'include',
          headers: token ? { 'Authorization': `Token ${token}` } : {}
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setUserLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [deliveryDate, setDeliveryDate] = useState<Date>(addDays(new Date(), 3));
  const [effectiveLeadTimeDays, setEffectiveLeadTimeDays] = useState(3);
  const [specialInstructions, setSpecialInstructions] = useState('');

  useEffect(() => {
    if (product) {
      // Compute total units from dose packs (sum of units_per_pack values)
      let totalUnits = 0;
      if (product.dosePacks && product.dosePacks.length > 0) {
        totalUnits = product.dosePacks.reduce((sum, dp) => 
          sum + (dp.units_per_pack || 0), 0);
      }
      
      // Calculate effective lead time: 3 weeks if no units, 3 days otherwise
      const leadTime = totalUnits === 0 ? 21 : 3;
      setEffectiveLeadTimeDays(leadTime);
      
      // Prefer dose packs if available
      if (product.dosePacks && product.dosePacks.length > 0) {
        setSelectedPackId(String(product.dosePacks[0].id));
      } else if (product.batches && product.batches.length > 0) {
        // Otherwise use batches
        setSelectedBatchId(String(product.batches[0].id));
      }
      setQuantity(product.minimumOrderQty || 1);
      setDeliveryDate(addDays(new Date(), leadTime));
    }
  }, [product]);

  // Update effective lead time when the user changes quantity or when product stock changes.
  // If the requested quantity is greater than current available stock, force a 3-week lead time
  // and prevent selecting an earlier delivery date by moving the selected date forward if needed.
  useEffect(() => {
    if (!product) return;

    const totalUnits = product.dosePacks && product.dosePacks.length > 0
      ? product.dosePacks.reduce((sum, dp) => sum + (dp.units_per_pack || 0), 0)
      : 0;

    // Base lead time: if no units, 3 weeks, otherwise product lead time or 3 days
    let leadTime = totalUnits === 0 ? 21 : (product.leadTimeDays || 3);

    const available = product.availableStock || 0;
    const requested = quantity || 0;

    if (requested > available) {
      leadTime = 21; // force 3 weeks when requested > available
    }

    setEffectiveLeadTimeDays(leadTime);

    const minDate = addDays(new Date(), leadTime);
    if (deliveryDate && deliveryDate.getTime() < minDate.getTime()) {
      setDeliveryDate(minDate);
    }
  }, [quantity, product]);

  if (loading) {
    return (
      <Layout>
        <div className="container-main py-16 text-center">
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="container-main py-16 text-center">
          <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-muted-foreground mb-4">The product you're looking for doesn't exist.</p>
          <Link to="/catalog">
            <Button>Back to Catalog</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const selectedPack = product.dosePacks?.find(dp => dp.id === selectedPackId);
  const selectedBatch = product.batches?.find(b => b.id === parseInt(selectedBatchId));

  const handleAddToCart = () => {
    // Handle dose pack selection
    if (selectedPackId && product.dosePacks) {
      const selectedPack = product.dosePacks.find(p => String(p.id) === selectedPackId);
      if (selectedPack) {
        addItem(
          { 
            id: product.id,
            name: product.name,
            brand: product.brand,
            species: product.species,
            description: product.description,
            type: product.type,
            availableStock: product.availableStock,
            dosePacks: product.dosePacks,
          } as any, 
          selectedPack, 
          quantity, 
          format(deliveryDate, 'yyyy-MM-dd'),
          specialInstructions
        );
        toast({
          title: "Added to cart",
          description: `${quantity}x ${product.name} (${selectedPack.doses} doses) added to your cart.`,
        });
        return;
      }
    }
    // Handle batch selection
    if (selectedBatchId && product.batches) {
      const selectedBatch = product.batches.find(b => String(b.id) === selectedBatchId);
      if (selectedBatch) {
        const batchAspack = {
          id: selectedBatch.id,
          doses: 1,
          units_per_pack: selectedBatch.quantity,
          batch_number: selectedBatch.batch_number,
          expiry_date: selectedBatch.expiry_date,
        } as any;
        
        addItem(
          { 
            id: product.id,
            name: product.name,
            brand: product.brand,
            species: product.species,
            description: product.description,
            type: product.type,
            availableStock: product.availableStock,
            batches: product.batches,
          } as any, 
          batchAspack, 
          quantity, 
          format(deliveryDate, 'yyyy-MM-dd'),
          specialInstructions
        );
        toast({
          title: "Added to cart",
          description: `${quantity}x ${product.name} added to your cart.`,
        });
        return;
      }
    }
    
    toast({
      title: "Please select an option",
      description: "Please select a dose pack or batch before adding to cart.",
      variant: "destructive",
    });
  };


  return (
    <Layout>
      <div className="container-main py-8 lg:py-12">
        {/* Breadcrumb */}
        <Link 
          to="/catalog" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </Link>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-square rounded-xl bg-gradient-to-br from-muted to-secondary overflow-hidden flex items-center justify-center">
              {product.image || (product.image_url && product.image_url !== '/placeholder.svg') ? (
                <img 
                  src={product.image || product.image_url} 
                  alt={product.image_alt || product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="h-32 w-32 text-muted-foreground/30" />
              )}
            </div>
            
            {/* Cold chain warning */}
            {product.coldChainRequired && (
              <Card className="border-cold-chain/30 bg-cold-chain/5">
                <CardContent className="flex items-start gap-3 py-4">
                  <Snowflake className="h-5 w-5 text-cold-chain shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Cold Chain Required</p>
                    <p className="text-sm text-muted-foreground">
                      This product must be stored at {product.storageTempRange}. 
                      Maintain cold chain during transport.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant={product.species}>{product.species}</Badge>
                <Badge variant={product.type}>{product.type}</Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mb-1">{product.brand}</p>
              <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
                {product.name}
              </h1>
              <p className="text-muted-foreground">{product.description}</p>
            </div>

            {/* Product Details Grid */}
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm font-medium text-foreground mb-1">Manufacturer</p>
                <p className="text-sm text-muted-foreground">{product.manufacturer}</p>
              </div>
            </div>

            {/* Active ingredients */}
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-sm font-medium text-foreground mb-1">Active Ingredients</p>
              <p className="text-sm text-muted-foreground">{product.activeIngredients}</p>
            </div>

            {/* Dose Pack or Batch Selection */}
            {product.dosePacks && product.dosePacks.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Select Dose Pack</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={selectedPackId} onValueChange={setSelectedPackId} className="space-y-3">
                    {product.dosePacks.map((pack) => (
                      <label
                        key={pack.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                          selectedPackId === String(pack.id) 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={String(pack.id)} />
                          <div>
                            <p className="font-medium">{pack.doses.toLocaleString()} doses</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            ) : product.batches && product.batches.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Select Batch</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={selectedBatchId} onValueChange={setSelectedBatchId} className="space-y-3">
                    {product.batches.map((batch) => (
                      <label
                        key={batch.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                          selectedBatchId === String(batch.id) 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={String(batch.id)} />
                          <div>
                            <p className="font-medium">{batch.batch_number}</p>
                            <p className="text-sm text-muted-foreground">
                              Exp: {batch.expiry_date} • {batch.available_quantity.toLocaleString()} units available
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">No Options Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">No dose packs or batches available for this product.</p>
                </CardContent>
              </Card>
            )}

            {/* Quantity & Delivery Date - Only show for non-staff users */}
            {!user?.is_staff && !user?.is_superuser && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(product.minimumOrderQty, quantity - 1))}
                    disabled={quantity <= product.minimumOrderQty}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(product.minimumOrderQty, parseInt(e.target.value) || 1))}
                    className="text-center w-20"
                    min={product.minimumOrderQty}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {product.minimumOrderQty > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Minimum order: {product.minimumOrderQty} units
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Requested Delivery Date</Label>
                <p className="text-xs text-muted-foreground">
                  {effectiveLeadTimeDays === 21
                    ? 'Lead time: 3 weeks'
                    : `Lead time: ${effectiveLeadTimeDays} days`
                  }
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(deliveryDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={deliveryDate}
                      onSelect={(date) => date && setDeliveryDate(date)}
                      disabled={(date) => date < addDays(new Date(), effectiveLeadTimeDays)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            )}

            {/* Special Instructions - Only show for non-staff users */}
            {!user?.is_staff && !user?.is_superuser && (
            <div className="space-y-2">
              <Label>Special Instructions</Label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Add any special instructions or notes for your order..."
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                rows={4}
              />
            </div>
            )}

            {/* Add to Cart - Only show for non-staff users */}
            {!user?.is_staff && !user?.is_superuser && (
            <div className="flex items-center justify-end p-4 rounded-lg bg-secondary/50">
              <Button 
                variant="hero" 
                size="lg"
                onClick={handleAddToCart}
                disabled={!selectedPackId && !selectedBatchId}
              >
                Add to Cart
              </Button>
            </div>
            )}

            {/* Administration Notes */}
            {product.administrationNotes && (
              <Card>
                <CardContent className="flex items-start gap-3 py-4">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Administration Notes</p>
                    <p className="text-sm text-muted-foreground">{product.administrationNotes}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
