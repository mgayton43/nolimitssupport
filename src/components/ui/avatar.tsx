'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'default' | 'lg';
}

function Avatar({
  className,
  src,
  alt,
  fallback,
  size = 'default',
  ...props
}: AvatarProps) {
  const [error, setError] = React.useState(false);

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800',
        {
          'h-8 w-8 text-xs': size === 'sm',
          'h-10 w-10 text-sm': size === 'default',
          'h-12 w-12 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {src && !error ? (
        <img
          src={src}
          alt={alt || ''}
          className="aspect-square h-full w-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-medium text-zinc-600 dark:text-zinc-400">
          {fallback || '?'}
        </span>
      )}
    </div>
  );
}

export { Avatar };
