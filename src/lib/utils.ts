import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const then = new Date(date);
  const diffInMs = now.getTime() - then.getTime();
  const isFuture = diffInMs < 0;
  const diffInSeconds = Math.floor(Math.abs(diffInMs) / 1000);

  const suffix = isFuture ? '' : ' ago';
  const prefix = isFuture ? 'in ' : '';

  if (diffInSeconds < 60) {
    return isFuture ? 'in less than a minute' : 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${prefix}${diffInMinutes}m${suffix}`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${prefix}${diffInHours}h${suffix}`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${prefix}${diffInDays}d${suffix}`;
  }

  return formatDate(date);
}

export function getInitials(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
