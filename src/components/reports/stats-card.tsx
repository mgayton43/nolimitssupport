import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export function StatsCard({ title, value, icon: Icon, description, trend }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
            {description && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
            )}
            {trend && (
              <p
                className={`mt-1 text-xs ${
                  trend.value >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
            <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
