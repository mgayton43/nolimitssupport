'use client';

import { Mail, Facebook, Instagram, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketChannel } from '@/lib/supabase/types';

interface ChannelIconProps {
  channel: TicketChannel;
  size?: 'sm' | 'default';
  showLabel?: boolean;
  className?: string;
}

const channelConfig: Record<TicketChannel, { icon: typeof Mail; label: string; color: string }> = {
  email: {
    icon: Mail,
    label: 'Email',
    color: 'text-blue-600 dark:text-blue-400',
  },
  facebook: {
    icon: Facebook,
    label: 'Facebook',
    color: 'text-[#1877F2]',
  },
  instagram: {
    icon: Instagram,
    label: 'Instagram',
    color: 'text-[#E4405F]',
  },
  manual: {
    icon: PenLine,
    label: 'Manual',
    color: 'text-zinc-500 dark:text-zinc-400',
  },
};

export function ChannelIcon({ channel, size = 'default', showLabel = false, className }: ChannelIconProps) {
  const config = channelConfig[channel];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (showLabel) {
    return (
      <span className={cn('flex items-center gap-1', className)}>
        <Icon className={cn(iconSize, config.color)} />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{config.label}</span>
      </span>
    );
  }

  return (
    <span title={config.label}>
      <Icon className={cn(iconSize, config.color, className)} />
    </span>
  );
}
