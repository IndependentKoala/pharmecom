import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductFilters } from '@/components/products/ProductFilters';
import { Package } from 'lucide-react';

interface ApiProduct {
  id: number;
  name: string;
  brand: string;
  species: string;
  description: string;
  image_url?: string;
  image?: string;
  image_alt?: string;
}

export default function Catalog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [species, setSpecies] = useState('all');
  const [brand, setBrand] = useState('all');
  const [type, setType] = useState('all');
  const [apiProducts, setApiProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch products from API
    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/products/', { 
          credentials: 'include',
          headers: token ? { 'Authorization': `Token ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setApiProducts(Array.isArray(data) ? data : []);
        } else {
          console.error('Failed to fetch products:', res.status);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Convert API products to match ProductCard interface
  const products = apiProducts.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    species: p.species,
    type: p.product_type || 'live', // Use actual product_type from API
    batchNumber: '',
    manufacturer: p.manufacturer,
    description: p.description,
    activeIngredients: p.active_ingredients || '',
    coldChainRequired: p.cold_chain_required,
    storageTempRange: p.storage_temp_range,
    minimumOrderQty: p.minimum_order_qty,
    leadTimeDays: p.lead_time_days,
    administrationNotes: p.administration_notes || '',
    availableStock: p.available_stock || 0,
    dosePacks: p.dose_packs || [],
    batches: p.batches || [],
    image: p.image,
    // Prefer an explicit image_url, then uploaded `image`, then fallback to placeholder
    image_url: p.image_url || p.image || '/placeholder.svg',
    image_alt: p.image_alt || p.name,
  }));

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSpecies = species === 'all' || product.species === species;
      const matchesBrand = brand === 'all' || product.brand === brand;
      const matchesType = type === 'all' || product.type === type;

      return matchesSearch && matchesSpecies && matchesBrand && matchesType;
    });
  }, [searchQuery, species, brand, type, products]);

  const clearFilters = () => {
    setSearchQuery('');
    setSpecies('all');
    setBrand('all');
    setType('all');
  };

  return (
    <Layout>
      <div className="container-main py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Vaccine Catalog
          </h1>
          <p className="text-muted-foreground">
            Browse our selection of premium veterinary vaccines
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <ProductFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            species={species}
            onSpeciesChange={setSpecies}
            brand={brand}
            onBrandChange={setBrand}
            type={type}
            onTypeChange={setType}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Results count */}
        <div className="mb-6 text-sm text-muted-foreground">
          {loading ? 'Loading products...' : `Showing ${filteredProducts.length} of ${products.length} products`}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Loading catalog...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                className="animate-slide-up h-full"
                style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
              No products found
            </h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters or search query
            </p>
            <button
              onClick={clearFilters}
              className="text-primary hover:underline text-sm font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
