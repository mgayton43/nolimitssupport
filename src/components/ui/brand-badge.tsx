import type { Brand } from '@/lib/supabase/types';

interface BrandBadgeProps {
  brand: Brand | null | undefined;
  size?: 'sm' | 'md';
}

export function BrandBadge({ brand, size = 'sm' }: BrandBadgeProps) {
  if (!brand) return null;

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses}`}
      style={{
        backgroundColor: `${brand.color}20`,
        color: brand.color,
        border: `1px solid ${brand.color}40`,
      }}
    >
      {brand.name}
    </span>
  );
}
