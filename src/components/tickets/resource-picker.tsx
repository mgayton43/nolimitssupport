'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Play, FileText, HelpCircle, BookOpen, Paperclip, Percent, Package, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Resource, ResourceType, PromoCode, Product } from '@/lib/supabase/types';

const typeIcons: Record<ResourceType, typeof Play> = {
  video: Play,
  article: FileText,
  faq: HelpCircle,
  guide: BookOpen,
};

const typeEmoji: Record<ResourceType, string> = {
  video: '📹',
  article: '📄',
  faq: '❓',
  guide: '📖',
};

function getResourceIcon(resource: Resource) {
  if (resource.is_uploaded) return Paperclip;
  return typeIcons[resource.type];
}

type TabType = 'resources' | 'promo-codes' | 'products';

interface ResourcePickerProps {
  resources: Resource[];
  promoCodes?: PromoCode[];
  products?: Product[];
  onSelect: (resource: Resource) => void;
  onCopyPromoCode?: (code: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ResourcePicker({
  resources,
  promoCodes = [],
  products = [],
  onSelect,
  onCopyPromoCode,
  isOpen,
  onClose
}: ResourcePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('resources');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(isOpen);

  // Determine which tabs to show
  const showResources = resources.length > 0;
  const showPromoCodes = promoCodes.length > 0;
  const showProducts = products.length > 0;
  const tabCount = [showResources, showPromoCodes, showProducts].filter(Boolean).length;

  // Focus search input when picker opens
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
      // Reset to first available tab
      if (showResources) setActiveTab('resources');
      else if (showPromoCodes) setActiveTab('promo-codes');
      else if (showProducts) setActiveTab('products');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, showResources, showPromoCodes, showProducts]);

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  // Filter resources based on search
  const filteredResources = resources.filter((resource) => {
    const query = searchQuery.toLowerCase();
    return (
      resource.title.toLowerCase().includes(query) ||
      resource.description?.toLowerCase().includes(query) ||
      resource.category?.toLowerCase().includes(query)
    );
  });

  // Filter promo codes based on search
  const filteredPromoCodes = promoCodes.filter((promo) => {
    const query = searchQuery.toLowerCase();
    return (
      promo.code.toLowerCase().includes(query) ||
      promo.description?.toLowerCase().includes(query)
    );
  });

  // Filter products based on search
  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.notes?.toLowerCase().includes(query)
    );
  });

  // Group resources by category
  const groupedResources = filteredResources.reduce(
    (acc, resource) => {
      const category = resource.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(resource);
      return acc;
    },
    {} as Record<string, Resource[]>
  );

  const handleResourceClick = (resource: Resource) => {
    onSelect(resource);
    setSearchQuery('');
    onClose();
  };

  const handleCopyPromoCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      onCopyPromoCode?.(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const formatDiscount = (promo: PromoCode) => {
    if (promo.discount_type === 'percentage') {
      return `${promo.discount_value}% off`;
    } else if (promo.discount_type === 'fixed_amount') {
      return `$${promo.discount_value} off`;
    } else {
      return 'Free shipping';
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return `$${price.toFixed(2)}`;
  };

  if (!isOpen) return null;

  const getPlaceholder = () => {
    switch (activeTab) {
      case 'resources': return 'Search resources...';
      case 'promo-codes': return 'Search promo codes...';
      case 'products': return 'Search products...';
    }
  };

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-96 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      onKeyDown={handleKeyDown}
    >
      {/* Tabs - only show if more than one tab */}
      {tabCount > 1 && (
        <div className="flex border-b border-zinc-200 dark:border-zinc-700">
          {showResources && (
            <button
              type="button"
              onClick={() => setActiveTab('resources')}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'resources'
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
            >
              <BookOpen className="mr-1.5 inline-block h-4 w-4" />
              Resources
            </button>
          )}
          {showPromoCodes && (
            <button
              type="button"
              onClick={() => setActiveTab('promo-codes')}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'promo-codes'
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
            >
              <Percent className="mr-1.5 inline-block h-4 w-4" />
              Promo Codes
            </button>
          )}
          {showProducts && (
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'products'
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
            >
              <Package className="mr-1.5 inline-block h-4 w-4" />
              Products
            </button>
          )}
        </div>
      )}

      {/* Search header */}
      <div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={getPlaceholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="max-h-72 overflow-auto">
        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <>
            {filteredResources.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                {searchQuery ? 'No matching resources' : 'No resources available'}
              </div>
            ) : (
              Object.entries(groupedResources).map(([category, categoryResources]) => (
                <div key={category}>
                  <div className="sticky top-0 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
                    {category}
                  </div>
                  {categoryResources.map((resource) => {
                    const TypeIcon = getResourceIcon(resource);
                    return (
                      <button
                        key={resource.id}
                        type="button"
                        onClick={() => handleResourceClick(resource)}
                        className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 flex-shrink-0 text-zinc-500" />
                          <span className="font-medium text-sm truncate">{resource.title}</span>
                          {resource.is_uploaded && (
                            <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-1 py-0.5 rounded">
                              File
                            </span>
                          )}
                        </div>
                        {resource.description && (
                          <p className="mt-0.5 pl-6 text-xs text-zinc-500 line-clamp-1">
                            {resource.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </>
        )}

        {/* Promo Codes Tab */}
        {activeTab === 'promo-codes' && (
          <>
            {filteredPromoCodes.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                {searchQuery ? 'No matching promo codes' : 'No promo codes available'}
              </div>
            ) : (
              filteredPromoCodes.map((promo) => (
                <div
                  key={promo.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{promo.code}</span>
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {formatDiscount(promo)}
                      </span>
                      {!promo.is_active && (
                        <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    {promo.description && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {promo.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyPromoCode(promo.code)}
                    className="ml-2 rounded p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
                    title="Copy code"
                  >
                    {copiedCode === promo.code ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <>
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                {searchQuery ? 'No matching products' : 'No products available'}
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-start gap-3 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-10 w-10 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-zinc-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{product.name}</span>
                      <span className="text-xs text-zinc-400 font-mono">{product.sku}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.discounted_price ? (
                        <>
                          <span className="text-xs text-green-600 font-medium dark:text-green-400">
                            {formatPrice(product.discounted_price)}
                          </span>
                          <span className="text-xs text-zinc-400 line-through">
                            {formatPrice(product.retail_price)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                          {formatPrice(product.retail_price)}
                        </span>
                      )}
                      <span className={cn(
                        'text-xs px-1 py-0.5 rounded',
                        product.stock_status === 'in_stock'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : product.stock_status === 'out_of_stock'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                      )}>
                        {product.stock_status.replace('_', ' ')}
                      </span>
                    </div>
                    {product.notes && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {product.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function formatResourceLink(resource: Resource): string {
  // Use paperclip emoji for uploaded files, type-specific emoji for links
  const emoji = resource.is_uploaded ? '📎' : typeEmoji[resource.type];
  return `${emoji} [${resource.title}](${resource.url})`;
}
