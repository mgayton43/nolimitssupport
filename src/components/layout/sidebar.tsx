'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  BarChart3,
  Settings,
  Tag,
  MessageSquare,
  UserCog,
  HelpCircle,
  Wand2,
  Gauge,
  Library,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { TicketViews } from './ticket-views';

const navigation = [
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

const settingsNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Canned Responses', href: '/settings/canned-responses', icon: MessageSquare },
  { name: 'Resources', href: '/settings/resources', icon: Library },
  { name: 'Tags', href: '/settings/tags', icon: Tag, adminOnly: true },
  { name: 'Tag Rules', href: '/settings/rules', icon: Wand2, adminOnly: true },
  { name: 'Priority Rules', href: '/settings/priority-rules', icon: Gauge, adminOnly: true },
  { name: 'Users', href: '/settings/users', icon: UserCog, adminOnly: true },
  { name: 'Import from Gorgias', href: '/settings/import', icon: Upload, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-16 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
        <Link href="/tickets" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <HelpCircle className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">NoLimits Support</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {/* Ticket Views */}
        <TicketViews />

        {/* Other Navigation */}
        <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Main
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}

        <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Settings
        </div>
        {settingsNavigation.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Logged in as{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {profile?.full_name || profile?.email}
          </span>
        </div>
        <div className="mt-1 text-xs capitalize text-zinc-500 dark:text-zinc-400">
          {profile?.role}
        </div>
      </div>
    </div>
  );
}
