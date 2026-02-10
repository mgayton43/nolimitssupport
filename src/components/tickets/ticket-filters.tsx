'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { Mail, Facebook, Instagram, PenLine } from 'lucide-react';
import type { Profile, Brand } from '@/lib/supabase/types';

// Sort options with labels and indicators
const sortOptions = [
  { value: 'newest', label: 'Newest first', icon: ArrowDown },
  { value: 'oldest', label: 'Oldest first', icon: ArrowUp },
  { value: 'last_message_newest', label: 'Last message (newest)', icon: ArrowDown },
  { value: 'last_message_oldest', label: 'Last message (oldest)', icon: ArrowUp },
  { value: 'priority_high', label: 'Priority (high to low)', icon: ArrowDown },
  { value: 'priority_low', label: 'Priority (low to high)', icon: ArrowUp },
] as const;

type SortOption = typeof sortOptions[number]['value'];

interface TicketFiltersProps {
  agents: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  brands: Brand[];
}

export function TicketFilters({ agents, brands }: TicketFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(
    searchParams.get('search') || ''
  );
  const debouncedSearch = useDebounce(searchValue, 300);

  // Hide assignee filter when viewing a specific inbox
  const currentView = searchParams.get('view');
  const hideAssigneeFilter = ['unassigned', 'my-inbox', 'agent'].includes(currentView || '');

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/tickets?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Update URL when debounced search value changes
  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      updateFilter('search', debouncedSearch);
    }
  }, [debouncedSearch, searchParams, updateFilter]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search tickets..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-64 pl-9"
        />
      </div>

      <Select
        value={searchParams.get('status') || 'all'}
        onValueChange={(value) => updateFilter('status', value)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('priority') || 'all'}
        onValueChange={(value) => updateFilter('priority', value)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>

      {!hideAssigneeFilter && (
        <Select
          value={searchParams.get('assignee') || 'all'}
          onValueChange={(value) => updateFilter('assignee', value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.full_name || agent.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={searchParams.get('channel') || 'all'}
        onValueChange={(value) => updateFilter('channel', value)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Channel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Channels</SelectItem>
          <SelectItem value="email">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              Email
            </div>
          </SelectItem>
          <SelectItem value="facebook">
            <div className="flex items-center gap-2">
              <Facebook className="h-4 w-4 text-[#1877F2]" />
              Facebook
            </div>
          </SelectItem>
          <SelectItem value="instagram">
            <div className="flex items-center gap-2">
              <Instagram className="h-4 w-4 text-[#E4405F]" />
              Instagram
            </div>
          </SelectItem>
          <SelectItem value="manual">
            <div className="flex items-center gap-2">
              <PenLine className="h-4 w-4 text-zinc-500" />
              Manual
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('brand') || 'all'}
        onValueChange={(value) => updateFilter('brand', value)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Brand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Brands</SelectItem>
          {brands.map((brand) => (
            <SelectItem key={brand.id} value={brand.id}>
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: brand.color }}
                />
                {brand.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('sort') || 'newest'}
        onValueChange={(value) => updateFilter('sort', value)}
      >
        <SelectTrigger className="w-48">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-zinc-400" />
            <SelectValue placeholder="Sort by" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => {
            const Icon = option.icon;
            return (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <Icon className="h-3 w-3 text-zinc-400" />
                  {option.label}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
