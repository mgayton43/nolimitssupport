'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
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
  Percent,
  Package,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { TicketViews } from './ticket-views';
import { Skeleton } from '@/components/ui/skeleton';

function TicketViewsSkeleton() {
  return (
    <div className="space-y-1">
      <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Tickets
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-5 w-5 bg-zinc-800" />
          <Skeleton className="h-4 w-24 bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children?: NavItem[];
}

// Main navigation - visible to all users
const mainNavigation: NavItem[] = [
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Canned Responses', href: '/settings/canned-responses', icon: MessageSquare },
  {
    name: 'Resources',
    href: '/settings/resources',
    icon: Library,
    children: [
      { name: 'Products', href: '/settings/products', icon: Package },
      { name: 'Promo Codes', href: '/settings/promo-codes', icon: Percent },
    ],
  },
  { name: 'Tags', href: '/settings/tags', icon: Tag },
];

// Settings navigation - admin only
const settingsNavigation: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
  {
    name: 'Rules',
    href: '/settings/rules',
    icon: Wand2,
    adminOnly: true,
    children: [
      { name: 'Tag Rules', href: '/settings/rules', icon: Wand2, adminOnly: true },
      { name: 'Priority Rules', href: '/settings/priority-rules', icon: Gauge, adminOnly: true },
    ],
  },
  { name: 'Users', href: '/settings/users', icon: UserCog, adminOnly: true },
  { name: 'Import from Gorgias', href: '/settings/import', icon: Upload, adminOnly: true },
];

function NavSection({
  items,
  pathname,
  isAdmin,
}: {
  items: NavItem[];
  pathname: string;
  isAdmin: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        if (item.adminOnly && !isAdmin) return null;

        const hasChildren = item.children && item.children.length > 0;
        const isActive = pathname === item.href;
        const isChildActive = hasChildren && item.children?.some(
          (child) => pathname === child.href
        );

        return (
          <div key={item.name}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive || isChildActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {hasChildren && (
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              )}
            </Link>

            {/* Nested children - always visible */}
            {hasChildren && (
              <div className="ml-4 mt-1 space-y-1 border-l border-zinc-800">
                {item.children?.map((child) => {
                  if (child.adminOnly && !isAdmin) return null;
                  const isChildItemActive = pathname === child.href;
                  return (
                    <Link
                      key={child.name}
                      href={child.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md py-1.5 pl-4 pr-3 text-sm font-medium transition-colors',
                        isChildItemActive
                          ? 'text-white'
                          : 'text-zinc-500 hover:text-white'
                      )}
                    >
                      <child.icon className="h-4 w-4" />
                      {child.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { profile, isLoading } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-zinc-800 px-6">
        <Link href="/tickets" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-900">
            <HelpCircle className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-white">NoLimits Support</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {/* Ticket Views */}
        <Suspense fallback={<TicketViewsSkeleton />}>
          <TicketViews />
        </Suspense>

        {/* Main Navigation */}
        <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Main
        </div>
        <NavSection items={mainNavigation} pathname={pathname} isAdmin={isAdmin} />

        {/* Settings Navigation - Admin Only */}
        {isAdmin && (
          <>
            <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Settings
            </div>
            <NavSection items={settingsNavigation} pathname={pathname} isAdmin={isAdmin} />
          </>
        )}
      </nav>

      {/* User Profile */}
      <div className="border-t border-zinc-800 p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-32 bg-zinc-800" />
            <Skeleton className="h-3 w-16 bg-zinc-800" />
          </div>
        ) : profile ? (
          <>
            <div className="text-xs text-zinc-500">
              Logged in as{' '}
              <span className="font-medium text-zinc-300">
                {profile.full_name || profile.email}
              </span>
            </div>
            <div className="mt-1 text-xs capitalize text-zinc-500">
              {profile.role}
            </div>
          </>
        ) : (
          <div className="text-xs text-red-400">
            Unable to load profile
          </div>
        )}
      </div>
    </div>
  );
}
