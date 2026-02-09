'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { addTagToTicket, removeTagFromTicket } from '@/lib/actions/tickets';
import { Plus, X, Tag as TagIcon } from 'lucide-react';
import type { Tag } from '@/lib/supabase/types';

interface TicketTagsBarProps {
  ticketId: string;
  tags: Tag[];
  allTags: Tag[];
}

export function TicketTagsBar({ ticketId, tags, allTags }: TicketTagsBarProps) {
  const [isPending, startTransition] = useTransition();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableTags = allTags.filter((t) => !tags.some((tt) => tt.id === t.id));

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tagId: string) => {
    startTransition(async () => {
      await addTagToTicket(ticketId, tagId);
      setIsDropdownOpen(false);
    });
  };

  const handleRemoveTag = (tagId: string) => {
    startTransition(async () => {
      await removeTagFromTicket(ticketId, tagId);
    });
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
      <TagIcon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />

      {/* Tags list */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.length === 0 && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">No tags</span>
        )}
        {tags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="group cursor-pointer pr-1 text-xs"
            style={{ backgroundColor: `${tag.color}20`, borderColor: tag.color }}
            onClick={() => !isPending && handleRemoveTag(tag.id)}
          >
            {tag.name}
            <X className="ml-1 h-3 w-3 opacity-50 group-hover:opacity-100" />
          </Badge>
        ))}

        {/* Add tag button/dropdown */}
        {availableTags.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isPending}
              className="flex items-center gap-1 rounded border border-dashed border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-40 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleAddTag(tag.id)}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
