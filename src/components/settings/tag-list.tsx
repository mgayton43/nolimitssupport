'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ExternalLink, Loader2, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { createTag, updateTag, deleteTag, getTicketsByTag, getTagTicketCounts, type TagTicket, type DateRange } from '@/lib/actions/tags';
import { cn } from '@/lib/utils';
import type { Tag } from '@/lib/supabase/types';

const colorOptions = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#84CC16', // lime
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#EC4899', // pink
  '#6B7280', // gray
];

const statusColors: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  closed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  snoozed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

// Preset date ranges
const presets = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
];

function getPresetDateRange(preset: string): DateRange {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString().split('T')[0], to: today };
    }
    case '30d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString().split('T')[0], to: today };
    }
    case '90d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 90);
      return { from: from.toISOString().split('T')[0], to: today };
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString().split('T')[0], to: today };
    }
    case 'year': {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: from.toISOString().split('T')[0], to: today };
    }
    default:
      return { from: null, to: null };
  }
}

interface TagListProps {
  tags: Tag[];
  ticketCounts: Record<string, number>;
}

export function TagList({ tags, ticketCounts: initialTicketCounts }: TagListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [selectedColor, setSelectedColor] = useState('#6B7280');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Date range state
  const [selectedPreset, setSelectedPreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>(initialTicketCounts);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  // Expandable state
  const [expandedTagId, setExpandedTagId] = useState<string | null>(null);
  const [tagTickets, setTagTickets] = useState<Record<string, { tickets: TagTicket[]; total: number; loading: boolean }>>({});

  // Refetch counts when date range changes
  useEffect(() => {
    // Skip initial render (all time)
    if (dateRange.from === null && dateRange.to === null && selectedPreset === 'all') {
      return;
    }

    const fetchCounts = async () => {
      setIsLoadingCounts(true);
      setTagTickets({}); // Clear cached tickets
      setExpandedTagId(null);

      const result = await getTagTicketCounts(dateRange);
      if ('counts' in result) {
        setTicketCounts(result.counts);
      }
      setIsLoadingCounts(false);
    };

    fetchCounts();
  }, [dateRange, selectedPreset]);

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    setCustomFrom('');
    setCustomTo('');
    if (preset === 'all') {
      setTicketCounts(initialTicketCounts);
      setTagTickets({});
      setExpandedTagId(null);
      setDateRange({ from: null, to: null });
    } else {
      setDateRange(getPresetDateRange(preset));
    }
  };

  const handleCustomDateApply = () => {
    if (customFrom || customTo) {
      setSelectedPreset('custom');
      setDateRange({ from: customFrom || null, to: customTo || null });
    }
  };

  const handleToggleExpand = async (tagId: string) => {
    if (expandedTagId === tagId) {
      setExpandedTagId(null);
      return;
    }

    setExpandedTagId(tagId);

    // Fetch tickets if not already loaded for current date range
    if (!tagTickets[tagId]) {
      setTagTickets((prev) => ({
        ...prev,
        [tagId]: { tickets: [], total: 0, loading: true },
      }));

      const result = await getTicketsByTag(tagId, 25, dateRange);

      if ('tickets' in result) {
        setTagTickets((prev) => ({
          ...prev,
          [tagId]: { tickets: result.tickets, total: result.total, loading: false },
        }));
      } else {
        setTagTickets((prev) => ({
          ...prev,
          [tagId]: { tickets: [], total: 0, loading: false },
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;

    if (!name) {
      setError('Name is required');
      return;
    }

    startTransition(async () => {
      let result;
      if (editingTag) {
        result = await updateTag({
          id: editingTag.id,
          name,
          color: selectedColor,
          description,
        });
      } else {
        result = await createTag({
          name,
          color: selectedColor,
          description: description || undefined,
        });
      }

      if (result && 'error' in result && result.error) {
        setError(result.error);
        console.error('Tag operation failed:', result.error);
        return;
      }

      setIsDialogOpen(false);
      setEditingTag(null);
      setError(null);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    startTransition(async () => {
      await deleteTag(id);
    });
  };

  const openCreateDialog = () => {
    setEditingTag(null);
    setSelectedColor('#6B7280');
    setError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTag(tag);
    setSelectedColor(tag.color);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleDelete(id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatDateRangeLabel = () => {
    if (selectedPreset === 'all') return 'All Time';
    if (selectedPreset === 'custom') {
      const parts = [];
      if (dateRange.from) parts.push(new Date(dateRange.from).toLocaleDateString());
      if (dateRange.to) parts.push(new Date(dateRange.to).toLocaleDateString());
      return parts.join(' - ') || 'Custom';
    }
    return presets.find((p) => p.value === selectedPreset)?.label || 'All Time';
  };

  return (
    <div className="p-6 space-y-4">
      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date Range:</span>
        </div>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePresetChange(preset.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                selectedPreset === preset.value
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
            placeholder="From"
          />
          <span className="text-zinc-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
            placeholder="To"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCustomDateApply}
            disabled={!customFrom && !customTo}
            className="h-7 text-xs"
          >
            Apply
          </Button>
        </div>

        {/* Loading indicator */}
        {isLoadingCounts && (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        )}

        {/* Current filter indicator */}
        {selectedPreset !== 'all' && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-zinc-500">
              Showing: <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatDateRangeLabel()}</span>
            </span>
            <button
              type="button"
              onClick={() => handlePresetChange('all')}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
              title="Clear filter"
            >
              <X className="h-3 w-3 text-zinc-400" />
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          No tags yet. Create your first one.
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => {
            const isExpanded = expandedTagId === tag.id;
            const ticketCount = ticketCounts[tag.id] || 0;
            const ticketData = tagTickets[tag.id];

            return (
              <div
                key={tag.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
              >
                {/* Tag Row */}
                <div
                  className={cn(
                    'flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors',
                    isExpanded && 'bg-zinc-50 dark:bg-zinc-800/50'
                  )}
                  onClick={() => handleToggleExpand(tag.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {ticketCount > 0 ? (
                      isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}

                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: `${tag.color}20`, borderColor: tag.color }}
                    >
                      <div
                        className="mr-1.5 h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </Badge>

                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {ticketCount} {ticketCount === 1 ? 'ticket' : 'tickets'}
                    </span>

                    {tag.description && (
                      <span className="text-sm text-zinc-400 dark:text-zinc-500 truncate hidden sm:block">
                        — {tag.description}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => openEditDialog(tag, e)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={(e) => handleDeleteClick(tag.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Ticket List */}
                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    {ticketData?.loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                      </div>
                    ) : ticketData?.tickets.length === 0 ? (
                      <div className="py-8 text-center text-sm text-zinc-500">
                        No tickets with this tag
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {ticketData?.tickets.map((ticket) => (
                            <Link
                              key={ticket.id}
                              href={`/tickets/${ticket.id}`}
                              className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
                            >
                              <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400 shrink-0">
                                #{ticket.ticket_number}
                              </span>
                              <span className="text-sm font-medium truncate flex-1">
                                {ticket.subject}
                              </span>
                              <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-32 hidden md:block">
                                {ticket.customer?.full_name || ticket.customer?.email || 'Unknown'}
                              </span>
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full capitalize shrink-0',
                                statusColors[ticket.status] || 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
                              )}>
                                {ticket.status}
                              </span>
                              <span className="text-xs text-zinc-400 shrink-0 hidden sm:block">
                                {formatDate(ticket.created_at)}
                              </span>
                              <ExternalLink className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 shrink-0" />
                            </Link>
                          ))}
                        </div>

                        {ticketData && ticketData.total > ticketData.tickets.length && (
                          <div className="px-4 py-3 text-center border-t border-zinc-200 dark:border-zinc-800">
                            <Link
                              href={`/tickets?tag=${tag.id}`}
                              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              View all {ticketData.total} tickets →
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setError(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                name="name"
                defaultValue={editingTag?.name}
                placeholder="e.g., Billing"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={editingTag?.description || ''}
                placeholder="When should agents use this tag?"
                rows={2}
                className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:focus:ring-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      selectedColor === color
                        ? 'scale-110 border-zinc-900 dark:border-zinc-100'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="pt-2">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Preview:</p>
              <Badge
                variant="secondary"
                className="mt-2"
                style={{ backgroundColor: `${selectedColor}20`, borderColor: selectedColor }}
              >
                <div
                  className="mr-1.5 h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedColor }}
                />
                {editingTag?.name || 'Tag name'}
              </Badge>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : editingTag ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
