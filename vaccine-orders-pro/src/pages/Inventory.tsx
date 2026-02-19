import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Package, TrendingDown, Calendar, Lock, Plus, RotateCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import api from '@/lib/api';
import { getImageSrc, getImageAlt } from '@/lib/utils';

interface Batch {
  id: number;
  batch_number: string;
  product: number;
  product_name?: string;
  expiry_date: string;
  quantity: number;
  quantity_reserved: number;
  available_quantity: number;
  status: string;
  storage_location: string;
  image_url?: string;
  image_alt?: string;
  created_at: string;
}

interface DosePack {
  id: number;
  product: number;
  doses: number;
  units_per_pack: number;
}

interface Product {
  id: number;
  name: string;
  brand: string;
  species: string;
  available_stock?: number;
  image?: string;
  image_url?: string;
  image_alt?: string;
  dose_packs?: DosePack[];
}

export default function Inventory() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [searchBatch, setSearchBatch] = useState('');
  const [sortBy, setSortBy] = useState<'expiry' | 'stock'>('expiry');

  const loadData = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/');
      return;
    }

    setLoading(true);
    Promise.all([
      fetch('/api/auth/user/', { headers: { 'Authorization': `Token ${token}` } }).then(r => r.json()),
      fetch('/api/batches/', { headers: { 'Authorization': `Token ${token}` } }).then(r => r.json()),
      fetch('/api/products/', { headers: { 'Authorization': `Token ${token}` } }).then(r => r.json()),
    ])
      .then(([user, batchesData, productsData]) => {
        if (!user?.is_staff) {
          navigate('/dashboard');
          return;
        }
        setCurrentUser(user);
        
        const batchesList = Array.isArray(batchesData) ? batchesData : [];
        setBatches(batchesList);
        
        const productsList = Array.isArray(productsData) ? productsData : [];
        setProducts(productsList);
        setLoading(false);
      })
      .catch((e) => {
        console.error('Error loading inventory:', e);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [navigate]);

  // Compute stock values: prefer available pack count from batches; fall back to units from dose_packs
  // But only show packs if dose pack has non-zero units
  const computeUnitsFromDosePacks = (p: Product) => {
    if (!p.dose_packs || p.dose_packs.length === 0) return 0;
    return p.dose_packs.reduce((sum, dp) => sum + (dp.units_per_pack || 0), 0);
  };

  const computeAvailablePacks = (p: Product) => {
    if (!p.batches || p.batches.length === 0) return 0;
    return p.batches.reduce((s, b) => s + (b.available_quantity || 0), 0);
  };

  // productStockMap holds pack counts when batches exist AND dose pack units > 0; otherwise unit totals
  const productStockMap: Record<number, number> = {};
  products.forEach((p) => {
    const totalUnits = computeUnitsFromDosePacks(p as any);
    const packs = computeAvailablePacks(p as any);
    // Only show packs if dose pack has units; if units are 0, show 0
    productStockMap[p.id] = totalUnits > 0 && packs > 0 ? packs : (totalUnits > 0 ? totalUnits : 0);
  });

  const filteredProducts = products
    .filter((p) => {
      const q = searchBatch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.species?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'stock') {
        return (productStockMap[a.id] || 0) - (productStockMap[b.id] || 0);
      }
      return a.name.localeCompare(b.name);
    });

  const getDaysUntilExpiry = (expiryDate: string) => {
    return differenceInDays(new Date(expiryDate), new Date());
  };

  const getExpiryBadge = (daysLeft: number) => {
    if (daysLeft < 0) return <Badge variant="destructive">Expired</Badge>;
    if (daysLeft < 30) return <Badge className="bg-orange-500 hover:bg-orange-600">Expiring Soon</Badge>;
    if (daysLeft < 90) return <Badge variant="secondary">60+ days</Badge>;
    return <Badge variant="outline">Safe</Badge>;
  };

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (quantity < 10) return <Badge className="bg-orange-500 hover:bg-orange-600">Low Stock</Badge>;
    return <Badge variant="success">In Stock</Badge>;
  };

  const outOfStockCount = products.filter((p) => {
    const totalUnits = computeUnitsFromDosePacks(p as any);
    const packs = computeAvailablePacks(p as any);
    const stockValue = totalUnits > 0 && packs > 0 ? packs : (totalUnits > 0 ? totalUnits : 0);
    return stockValue === 0;
  }).length;

  if (loading) {
    return (
      <Layout>
        <div className="container-main py-8">
          <p>Loading inventory...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-main py-8 lg:py-12">
          <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
              Inventory Management
            </h1>
            <p className="text-muted-foreground">
              Manage vaccine stock and products
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Refresh
            </Button>
            {currentUser?.is_superuser && (
            <Button onClick={() => navigate('/add-product')} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Out of Stock</p>
                  <p className="text-3xl font-bold">{outOfStockCount}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-3xl font-bold">{products.length}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Lock className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {outOfStockCount > 0 && (
          <Card className="mb-8 border-orange-200 bg-orange-50">
            <CardContent className="p-6 flex gap-4">
              <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900 mb-1">Inventory Alerts</p>
                <p className="text-sm text-orange-800">
                  {outOfStockCount} products out of stock.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            placeholder="Search product..."
            value={searchBatch}
            onChange={(e) => setSearchBatch(e.target.value)}
            className="flex-1"
          />
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expiry">Expiry Date</SelectItem>
              <SelectItem value="stock">Stock Level</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Products ({filteredProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No products found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Dose Pack</TableHead>
                      <TableHead>Species</TableHead>
                      <TableHead className="text-right">Total Stock</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const stock = productStockMap[product.id] || 0;
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="flex items-center gap-3">
                              <img
                                src={getImageSrc(product) || '/placeholder.svg'}
                                alt={getImageAlt(product)}
                                className="h-10 w-10 rounded object-cover"
                              />
                            <span>{product.name}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{product.brand || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.dose_packs && product.dose_packs.length > 0
                              ? product.dose_packs.map((dp) => `${dp.doses} doses`).join(', ')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{product.species || '-'}</TableCell>
                          <TableCell className="text-right font-semibold">{stock}</TableCell>
                          <TableCell>{getStockBadge(stock)}</TableCell>

                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
