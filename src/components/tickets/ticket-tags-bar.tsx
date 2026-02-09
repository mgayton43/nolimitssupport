'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { addTagToTicket, removeTagFromTicket } from '@/lib/actions/tickets';
import { X, Tag as TagIcon } from 'lucide-react';
import type { Tag } from '@/lib/supabase/types';

interface TicketTagsBarProps {
  ticketId: string;
  tags: Tag[];
  allTags: Tag[];
}

export function TicketTagsBar({ ticketId, tags, allTags }: TicketTagsBarProps) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableTags = allTags.filter((t) => !tags.some((tt) => tt.id === t.id));

  // Filter tags based on search query
  const filteredTags = searchQuery.trim()
    ? availableTags.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableTags;

  const showDropdown = isInputFocused && filteredTags.length > 0;

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsInputFocused(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tagId: string) => {
    startTransition(async () => {
      await addTagToTicket(ticketId, tagId);
      setSearchQuery('');
      setIsInputFocused(false);
    });
  };

  const handleRemoveTag = (tagId: string) => {
    startTransition(async () => {
      await removeTagFromTicket(ticketId, tagId);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredTags.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredTags.length) % filteredTags.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredTags[selectedIndex]) {
          handleAddTag(filteredTags[selectedIndex].id);
        }
        break;
      case 'Escape':
        setIsInputFocused(false);
        setSearchQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
      <TagIcon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />

      {/* Tags list */}
      <div className="flex flex-wrap items-center gap-1.5">
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

        {/* Add tag input with dropdown */}
        {availableTags.length > 0 && (
          <div className="relative" ref={containerRef}>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder={tags.length === 0 ? 'Add tag...' : 'Add...'}
              disabled={isPending}
              className="w-20 rounded border border-dashed border-zinc-300 bg-transparent px-1.5 py-0.5 text-xs placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-0 dark:border-zinc-600 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 disabled:opacity-50"
            />

            {showDropdown && (
              <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-44 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {filteredTags.map((tag, index) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleAddTag(tag.id)}
                    disabled={isPending}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm disabled:opacity-50 ${
                      index === selectedIndex
                        ? 'bg-zinc-100 dark:bg-zinc-800'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
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

        {/* Show message when no more tags available */}
        {tags.length === 0 && availableTags.length === 0 && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">No tags available</span>
        )}
      </div>
    </div>
  );
}
