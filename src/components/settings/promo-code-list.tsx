'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, Search, Copy, Check, Percent, DollarSign, Truck } from 'lucide-react';
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
import { createPromoCode, updatePromoCode, deletePromoCode } from '@/lib/actions/promo-codes';
import type { PromoCode, DiscountType, PromoSource, Brand } from '@/lib/supabase/types';

interface PromoCodeListProps {
  promoCodes: PromoCode[];
  brands: Pick<Brand, 'id' | 'name' | 'color'>[];
}

const DISCOUNT_TYPE_OPTIONS: { value: DiscountType; label: string; icon: typeof Percent }[] = [
  { value: 'percentage', label: 'Percentage', icon: Percent },
  { value: 'fixed_amount', label: 'Fixed Amount', icon: DollarSign },
  { value: 'free_shipping', label: 'Free Shipping', icon: Truck },
];

const SOURCE_OPTIONS: { value: PromoSource; label: string }[] = [
  { value: 'email_flow', label: 'Email Flow' },
  { value: 'website', label: 'Website' },
  { value: 'ads', label: 'Ads' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
      title="Copy code"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 text-zinc-400" />
      )}
    </button>
  );
}

function formatDiscount(type: DiscountType, value: number): string {
  switch (type) {
    case 'percentage':
      return `${value}% off`;
    case 'fixed_amount':
      return `$${value.toFixed(2)} off`;
    case 'free_shipping':
      return 'Free Shipping';
    default:
      return String(value);
  }
}

function getStatusBadge(promoCode: PromoCode) {
  if (!promoCode.is_active) {
    return <Badge variant="secondary">Inactive</Badge>;
  }
  if (promoCode.expiration_date && new Date(promoCode.expiration_date) < new Date()) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  return <Badge variant="success">Active</Badge>;
}

export function PromoCodeList({ promoCodes, brands }: PromoCodeListProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterSource, setFilterSource] = useState<PromoSource | 'all'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as DiscountType,
    discount_value: 0,
    is_active: true,
    is_stackable: false,
    applies_to: 'all',
    source: '' as PromoSource | '',
    source_details: '',
    expiration_date: '',
    brand_id: '',
  });

  const filteredCodes = promoCodes.filter((code) => {
    if (search && !code.code.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterActive === 'active' && !code.is_active) return false;
    if (filterActive === 'inactive' && code.is_active) return false;
    if (filterSource !== 'all' && code.source !== filterSource) return false;
    return true;
  });

  const openDialog = (code?: PromoCode) => {
    if (code) {
      setEditingCode(code);
      setFormData({
        code: code.code,
        description: code.description || '',
        discount_type: code.discount_type,
        discount_value: code.discount_value,
        is_active: code.is_active,
        is_stackable: code.is_stackable,
        applies_to: code.applies_to,
        source: code.source || '',
        source_details: code.source_details || '',
        expiration_date: code.expiration_date || '',
        brand_id: code.brand_id || '',
      });
    } else {
      setEditingCode(null);
      setFormData({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 0,
        is_active: true,
        is_stackable: false,
        applies_to: 'all',
        source: '',
        source_details: '',
        expiration_date: '',
        brand_id: '',
      });
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.code.trim()) {
      setError('Code is required');
      return;
    }
    if (formData.discount_type !== 'free_shipping' && formData.discount_value <= 0) {
      setError('Discount value must be greater than 0');
      return;
    }

    startTransition(async () => {
      const data = {
        code: formData.code,
        description: formData.description || undefined,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        is_active: formData.is_active,
        is_stackable: formData.is_stackable,
        applies_to: formData.applies_to,
        source: formData.source || undefined,
        source_details: formData.source_details || undefined,
        expiration_date: formData.expiration_date || undefined,
        brand_id: formData.brand_id || undefined,
      };

      const result = editingCode
        ? await updatePromoCode({ id: editingCode.id, ...data })
        : await createPromoCode(data);

      if ('error' in result) {
        setError(result.error);
      } else {
        setIsDialogOpen(false);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this promo code?')) return;

    startTransition(async () => {
      const result = await deletePromoCode(id);
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
              placeholder="Search codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <Select value={filterActive} onValueChange={(v) => setFilterActive(v as typeof filterActive)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={(v) => setFilterSource(v as typeof filterSource)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Promo Code
        </Button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredCodes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No promo codes found
                </td>
              </tr>
            ) : (
              filteredCodes.map((code) => (
                <tr key={code.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-lg">{code.code}</span>
                      <CopyButton text={code.code} />
                    </div>
                    {code.description && (
                      <p className="text-sm text-zinc-500 mt-0.5">{code.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{formatDiscount(code.discount_type, code.discount_value)}</span>
                    {code.is_stackable && (
                      <Badge variant="outline" className="ml-2 text-[10px]">Stackable</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {code.source ? SOURCE_OPTIONS.find(s => s.value === code.source)?.label : '-'}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(code)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {code.expiration_date
                      ? new Date(code.expiration_date).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openDialog(code)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(code.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCode ? 'Edit Promo Code' : 'Add Promo Code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm font-mono uppercase dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="SAVE20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="What is this promo for?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Discount Type *</label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(v) => setFormData({ ...formData, discount_type: v as DiscountType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {formData.discount_type === 'percentage' ? 'Percentage' : 'Amount'} *
                </label>
                <input
                  type="number"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  min="0"
                  step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                  disabled={formData.discount_type === 'free_shipping'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Source</label>
                <Select
                  value={formData.source || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, source: v === 'none' ? '' : v as PromoSource })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Brand</label>
              <Select
                value={formData.brand_id || 'all'}
                onValueChange={(v) => setFormData({ ...formData, brand_id: v === 'all' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_stackable}
                  onChange={(e) => setFormData({ ...formData, is_stackable: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Stackable</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {editingCode ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
