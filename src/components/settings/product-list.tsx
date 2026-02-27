'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, Search, Package, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createProduct, updateProduct, deleteProduct } from '@/lib/actions/products';
import type { Product, ProductAvailability, StockStatus, Brand } from '@/lib/supabase/types';

interface ProductListProps {
  products: Product[];
  brands: Pick<Brand, 'id' | 'name' | 'color'>[];
}

const AVAILABILITY_OPTIONS: { value: ProductAvailability; label: string }[] = [
  { value: 'us_only', label: 'US Only' },
  { value: 'canada_only', label: 'Canada Only' },
  { value: 'us_and_canada', label: 'US & Canada' },
];

const STOCK_STATUS_OPTIONS: { value: StockStatus; label: string; color: string }[] = [
  { value: 'in_stock', label: 'In Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'out_of_stock', label: 'Out of Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'discontinued', label: 'Discontinued', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
  { value: 'pre_order', label: 'Pre-Order', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
];

function getStockBadge(status: StockStatus) {
  const opt = STOCK_STATUS_OPTIONS.find(s => s.value === status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${opt?.color || ''}`}>
      {opt?.label || status}
    </span>
  );
}

export function ProductList({ products, brands }: ProductListProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<StockStatus | 'all'>('all');
  const [filterAvailability, setFilterAvailability] = useState<ProductAvailability | 'all'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    image_url: '',
    whats_included: '',
    retail_price: 0,
    discounted_price: 0,
    availability: 'us_and_canada' as ProductAvailability,
    stock_status: 'in_stock' as StockStatus,
    notes: '',
    brand_id: '',
  });

  const filteredProducts = products.filter((product) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!product.sku.toLowerCase().includes(searchLower) &&
          !product.name.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (filterStatus !== 'all' && product.stock_status !== filterStatus) return false;
    if (filterAvailability !== 'all' && product.availability !== filterAvailability) return false;
    return true;
  });

  const openDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku,
        name: product.name,
        image_url: product.image_url || '',
        whats_included: product.whats_included || '',
        retail_price: product.retail_price || 0,
        discounted_price: product.discounted_price || 0,
        availability: product.availability,
        stock_status: product.stock_status,
        notes: product.notes || '',
        brand_id: product.brand_id || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        sku: '',
        name: '',
        image_url: '',
        whats_included: '',
        retail_price: 0,
        discounted_price: 0,
        availability: 'us_and_canada',
        stock_status: 'in_stock',
        notes: '',
        brand_id: '',
      });
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.sku.trim()) {
      setError('SKU is required');
      return;
    }
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    startTransition(async () => {
      const data = {
        sku: formData.sku,
        name: formData.name,
        image_url: formData.image_url || undefined,
        whats_included: formData.whats_included || undefined,
        retail_price: formData.retail_price || undefined,
        discounted_price: formData.discounted_price || undefined,
        availability: formData.availability,
        stock_status: formData.stock_status,
        notes: formData.notes || undefined,
        brand_id: formData.brand_id || undefined,
      };

      const result = editingProduct
        ? await updateProduct({ id: editingProduct.id, ...data })
        : await createProduct(data);

      if ('error' in result) {
        setError(result.error);
      } else {
        setIsDialogOpen(false);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    startTransition(async () => {
      const result = await deleteProduct(id);
      if ('error' in result) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search SKU or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STOCK_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAvailability} onValueChange={(v) => setFilterAvailability(v as typeof filterAvailability)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {AVAILABILITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-500">
            No products found
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-lg border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Image */}
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-16 w-16 text-zinc-300 dark:text-zinc-600" />
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm line-clamp-2">{product.name}</p>
                    <p className="text-xs font-mono text-zinc-500">{product.sku}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStockBadge(product.stock_status)}
                  <Badge variant="outline" className="text-[10px]">
                    {AVAILABILITY_OPTIONS.find(a => a.value === product.availability)?.label}
                  </Badge>
                </div>

                {(product.retail_price || product.discounted_price) && (
                  <div className="flex items-center gap-2 text-sm">
                    {product.discounted_price && (
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        ${product.discounted_price.toFixed(2)}
                      </span>
                    )}
                    {product.retail_price && (
                      <span className={product.discounted_price ? 'line-through text-zinc-400' : 'font-semibold'}>
                        ${product.retail_price.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <Button variant="ghost" size="sm" onClick={() => openDialog(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">SKU *</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm font-mono uppercase dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="STK-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Brand</label>
                <Select
                  value={formData.brand_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, brand_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Brand</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="Product name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Image URL</label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">What&apos;s Included</label>
              <textarea
                value={formData.whats_included}
                onChange={(e) => setFormData({ ...formData, whats_included: e.target.value })}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                rows={3}
                placeholder="Description of what's in the box..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Retail Price</label>
                <input
                  type="number"
                  value={formData.retail_price || ''}
                  onChange={(e) => setFormData({ ...formData, retail_price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Discounted Price</label>
                <input
                  type="number"
                  value={formData.discounted_price || ''}
                  onChange={(e) => setFormData({ ...formData, discounted_price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Stock Status</label>
                <Select
                  value={formData.stock_status}
                  onValueChange={(v) => setFormData({ ...formData, stock_status: v as StockStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Availability</label>
                <Select
                  value={formData.availability}
                  onValueChange={(v) => setFormData({ ...formData, availability: v as ProductAvailability })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Internal Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                rows={2}
                placeholder="Notes for agents..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {editingProduct ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
