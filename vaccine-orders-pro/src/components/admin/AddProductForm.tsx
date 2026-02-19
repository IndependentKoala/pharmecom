import { useState } from 'react';
import { Plus, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface DosePackInput {
  doses: string;
  unitsPerPack: string;
}

export function AddProductForm() {
  const [open, setOpen] = useState(false);
  const [dosePacks, setDosePacks] = useState<DosePackInput[]>([{ doses: '', unitsPerPack: '1' }]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    batchNumber: '',
    brand: '',
    species: 'poultry',
    type: 'live',
    manufacturer: '',
    description: '',
    activeIngredients: '',
    coldChainRequired: true,
    storageTempRange: '2-8°C',
    minimumOrderQty: '1',
    leadTimeDays: '3',
    administrationNotes: '',
    imageUrl: '',
    imageAlt: '',
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        handleInputChange('imageUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addDosePack = () => {
    setDosePacks(prev => [...prev, { doses: '', unitsPerPack: '1' }]);
  };

  const removeDosePack = (index: number) => {
    setDosePacks(prev => prev.filter((_, i) => i !== index));
  };

  const updateDosePack = (index: number, field: keyof DosePackInput, value: string) => {
    setDosePacks(prev => prev.map((pack, i) => 
      i === index ? { ...pack, [field]: value } : pack
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.batchNumber || !formData.brand) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate dose packs
    const validDosePacks = dosePacks.filter(dp => dp.doses && parseInt(dp.doses) > 0);
    if (validDosePacks.length === 0) {
      toast({
        title: "Invalid dose packs",
        description: "Please add at least one valid dose pack.",
        variant: "destructive",
      });
      return;
    }

    // In a real app, this would save to a database
    toast({
      title: "Product added",
      description: `${formData.name} has been added to the catalog.`,
    });

    // Reset form
    setFormData({
      name: '',
      batchNumber: '',
      brand: '',
      species: 'poultry',
      type: 'live',
      manufacturer: '',
      description: '',
      activeIngredients: '',
      coldChainRequired: true,
      storageTempRange: '2-8°C',
      minimumOrderQty: '1',
      leadTimeDays: '3',
      administrationNotes: '',
      imageUrl: '',
      imageAlt: '',
    });
    setDosePacks([{ doses: '', unitsPerPack: '1' }]);
    setImagePreview(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Newcastle Disease Vaccine"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch Number *</Label>
              <Input
                id="batchNumber"
                value={formData.batchNumber}
                onChange={(e) => handleInputChange('batchNumber', e.target.value)}
                placeholder="e.g., NDV-2024-A1"
                required
              />
            </div>
          </div>

          {/* Image Upload */}
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
                      <Label htmlFor="imageUrl">Image URL</Label>
                      <Input
                        id="imageUrl"
                        value={formData.imageUrl}
                        onChange={(e) => {
                          const v = e.target.value;
                          handleInputChange('imageUrl', v);
                          setImagePreview(v || null);
                        }}
                        placeholder="/images/product.jpg or https://..."
                      />

                      <Label htmlFor="imageAlt">Image Alt Text</Label>
                      <Input
                        id="imageAlt"
                        value={formData.imageAlt}
                        onChange={(e) => handleInputChange('imageAlt', e.target.value)}
                        placeholder="Describe the image for accessibility"
                      />
                    </div>
              </div>
              {imagePreview && (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      handleInputChange('imageUrl', '');
                    }}
                    className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => handleInputChange('brand', e.target.value)}
                placeholder="e.g., MSD Animal Health"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                placeholder="e.g., MSD Animal Health"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Species *</Label>
              <Select value={formData.species} onValueChange={(v) => handleInputChange('species', v)}>
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
              <Label>Vaccine Type *</Label>
              <Select value={formData.type} onValueChange={(v) => handleInputChange('type', v)}>
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

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Product description..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activeIngredients">Active Ingredients</Label>
            <Input
              id="activeIngredients"
              value={formData.activeIngredients}
              onChange={(e) => handleInputChange('activeIngredients', e.target.value)}
              placeholder="e.g., Newcastle Disease Virus, La Sota strain"
            />
          </div>

          {/* Dose Packs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Dose Packs *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDosePack}>
                <Plus className="h-3 w-3 mr-1" />
                Add Pack
              </Button>
            </div>
            {dosePacks.map((pack, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Doses (e.g., 1000)"
                    value={pack.doses}
                    onChange={(e) => updateDosePack(index, 'doses', e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    placeholder="Units"
                    value={pack.unitsPerPack}
                    onChange={(e) => updateDosePack(index, 'unitsPerPack', e.target.value)}
                  />
                </div>
                {dosePacks.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDosePack(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Storage & Lead Time */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="storageTempRange">Storage Temp</Label>
              <Input
                id="storageTempRange"
                value={formData.storageTempRange}
                onChange={(e) => handleInputChange('storageTempRange', e.target.value)}
                placeholder="2-8°C"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimumOrderQty">Min Order Qty</Label>
              <Input
                id="minimumOrderQty"
                type="number"
                value={formData.minimumOrderQty}
                onChange={(e) => handleInputChange('minimumOrderQty', e.target.value)}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
              <Input
                id="leadTimeDays"
                type="number"
                value={formData.leadTimeDays}
                onChange={(e) => handleInputChange('leadTimeDays', e.target.value)}
                min="1"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="coldChain"
              checked={formData.coldChainRequired}
              onCheckedChange={(v) => handleInputChange('coldChainRequired', v)}
            />
            <Label htmlFor="coldChain">Cold Chain Required</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="administrationNotes">Administration Notes</Label>
            <Textarea
              id="administrationNotes"
              value={formData.administrationNotes}
              onChange={(e) => handleInputChange('administrationNotes', e.target.value)}
              placeholder="Administration instructions..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add Product
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}