import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, X, Plus } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface DosePack {
  doses: number;
  units_per_pack: number;
}

export default function AdminAddProduct() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    brand: '',
    species: 'poultry',
    product_type: 'live',
    description: '',
    manufacturer: '',
    active_ingredients: '',
    storage_temp_range: '2-8°C',
    administration_notes: '',
    image_alt: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [batches, setBatches] = useState<DosePack[]>([{ doses: 0, units_per_pack: 0 }]);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const addBatch = () => {
    setBatches([...batches, { doses: 0, units_per_pack: 0 }]);
  };

  const removeBatch = (index: number) => {
    setBatches(batches.filter((_, i) => i !== index));
  };

  const updateBatch = (index: number, field: keyof DosePack, value: any) => {
    const newBatches = [...batches];
    newBatches[index] = { ...newBatches[index], [field]: value };
    setBatches(newBatches);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('API_BASE:', API_BASE);
    const token = localStorage.getItem('authToken');
    console.log('Token from localStorage:', token);
    console.log('Token length:', token?.length);
    console.log('Token has whitespace:', token !== token?.trim());
    
    if (!token) {
      navigate('/');
      return;
    }

    // Validate required fields
    if (!form.name || !form.brand || !form.species || !form.product_type || !form.description || !form.active_ingredients || !form.storage_temp_range || !form.administration_notes) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in all required fields (marked with *).',
        variant: 'destructive',
      });
      return;
    }

    // Validate doses are required
    if (batches.length === 0) {
      toast({
        title: 'Missing doses',
        description: 'At least one dose pack is required.',
        variant: 'destructive',
      });
      return;
    }

    // Validate doses
    for (const batch of batches) {
      if (batch.doses === 0 || batch.units_per_pack === 0) {
        toast({
          title: 'Invalid dose pack',
          description: 'All dose pack fields are required and must be greater than 0.',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);

    try {
      let res: Response;
      // Trim token to remove any whitespace
      const cleanToken = token.trim();

      if (imageFile) {
        // Use FormData for file upload
        const formData = new FormData();
        formData.append('name', form.name);
        formData.append('brand', form.brand);
        formData.append('species', form.species);
        formData.append('product_type', form.product_type);
        formData.append('description', form.description);
        formData.append('manufacturer', form.manufacturer);
        formData.append('active_ingredients', form.active_ingredients);
        formData.append('storage_temp_range', form.storage_temp_range);
        formData.append('administration_notes', form.administration_notes);
        formData.append('image_alt', form.image_alt);
        // available_stock is derived from dose packs; do not send initial stock
        formData.append('image', imageFile);
        
        console.log('Sending FormData with image');

        res = await fetch(`${API_BASE}/products/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${cleanToken}`,
          },
          body: formData,
          credentials: 'include',
        });
      } else {
        // Use JSON for non-image requests
        const payload = {
          name: form.name,
          brand: form.brand,
          species: form.species,
          product_type: form.product_type,
          description: form.description,
          manufacturer: form.manufacturer,
          active_ingredients: form.active_ingredients,
          storage_temp_range: form.storage_temp_range,
          administration_notes: form.administration_notes,
          image_alt: form.image_alt,
        };
        
        console.log('Sending JSON payload:', payload);
        
        res = await fetch(`${API_BASE}/products/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${cleanToken}`,
          },
            body: JSON.stringify(payload),
          credentials: 'include',
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('API Error Response:', { status: res.status, data: errorData });
        console.log('Full error object:', JSON.stringify(errorData, null, 2));
        
        // Handle validation errors from DRF
        let errorMessage = 'Failed to create product';
        if (typeof errorData === 'object') {
          // DRF returns validation errors as an object with field names as keys
          const errors = Object.entries(errorData)
            .filter(([key]) => key !== 'detail' && key !== 'error')
            .map(([key, value]: [string, any]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join('; ');
          
          if (errors) {
            errorMessage = errors;
          } else if (errorData?.detail) {
            errorMessage = errorData.detail;
          } else if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
        
        throw new Error(errorMessage);
      }

      const product = await res.json();

      // Create dose packs if any
      if (batches.length > 0 && product.id) {
        for (const batch of batches) {
          await fetch(`${API_BASE}/dosepacks/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Token ${cleanToken}`,
            },
            body: JSON.stringify({
              product: product.id,
              doses: batch.doses,
              units_per_pack: batch.units_per_pack,
            }),
            credentials: 'include',
          });
        }
      }

      toast({
        title: 'Success',
        description: `Product "${form.name}" has been added successfully with ${batches.length} dose pack(s).`,
      });

      navigate('/inventory');
    } catch (err: any) {
      console.error('Error creating product:', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to create product',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container-main py-8 lg:py-12">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">
              Add New Product
            </h1>
            <p className="text-muted-foreground">Create a new vaccine product</p>
          </div>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Newcastle Disease Vaccine"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand *</Label>
                  <Input
                    id="brand"
                    value={form.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    placeholder="e.g., BOEHRINGER INGELHEIM"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="species">Species *</Label>
                  <Select value={form.species} onValueChange={(v) => handleInputChange('species', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poultry">Poultry</SelectItem>
                      <SelectItem value="swine">Swine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product_type">Vaccine Type *</Label>
                  <Select value={form.product_type} onValueChange={(v) => handleInputChange('product_type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="killed">Killed</SelectItem>
                      <SelectItem value="attenuated">Attenuated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={form.manufacturer}
                    onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                    placeholder="e.g., BOEHRINGER INGELHEIM"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage_temp_range">Storage Temp *</Label>
                  <Input
                    id="storage_temp_range"
                    value={form.storage_temp_range}
                    onChange={(e) => handleInputChange('storage_temp_range', e.target.value)}
                    placeholder="e.g., 2-8°C"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Product description..."
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="active_ingredients">Active Ingredients *</Label>
                <Textarea
                  id="active_ingredients"
                  value={form.active_ingredients}
                  onChange={(e) => handleInputChange('active_ingredients', e.target.value)}
                  placeholder="e.g., Newcastle Disease Virus, La Sota strain"
                  rows={2}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="administration_notes">Administration Notes *</Label>
                <Textarea
                  id="administration_notes"
                  value={form.administration_notes}
                  onChange={(e) => handleInputChange('administration_notes', e.target.value)}
                  placeholder="Administration instructions..."
                  rows={2}
                  required
                />
              </div>

              {/* Initial stock removed — total units come from dose packs */}

              <div className="space-y-3">
                <Label>Product Image</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">Upload Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imageAlt">Image Alt Text</Label>
                      <Input
                        id="imageAlt"
                        value={form.image_alt}
                        onChange={(e) => handleInputChange('image_alt', e.target.value)}
                        placeholder="Describe the image for accessibility (optional)"
                      />
                    </div>
                  </div>
                  {imagePreview && (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-destructive-foreground hover:bg-destructive/90"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-semibold">Doses *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBatch}
                    disabled={batches.length >= 1}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Dose
                  </Button>
                </div>

                {batches.length > 0 && (
                  <div className="space-y-4">
                    {batches.map((batch, index) => (
                      <div
                        key={index}
                        className="p-4 border rounded-lg space-y-4 bg-secondary/30"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-sm">Dose {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeBatch(index)}
                            className="p-1 hover:bg-destructive/20 rounded transition-colors"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`doses_${index}`} className="text-sm">
                              Number of Doses *
                            </Label>
                            <Input
                              id={`doses_${index}`}
                              type="number"
                              value={batch.doses || ''}
                              onChange={(e) => updateBatch(index, 'doses', parseInt(e.target.value) || 0)}
                              min="1"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`units_per_pack_${index}`} className="text-sm">
                              Stock *
                            </Label>
                            <Input
                              id={`units_per_pack_${index}`}
                              type="number"
                              value={batch.units_per_pack || ''}
                              onChange={(e) => updateBatch(index, 'units_per_pack', parseInt(e.target.value) || 0)}
                              min="1"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Product'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/inventory')}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
