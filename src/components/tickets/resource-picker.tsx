'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Play, FileText, HelpCircle, BookOpen, Paperclip } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Resource, ResourceType } from '@/lib/supabase/types';

const typeIcons: Record<ResourceType, typeof Play> = {
  video: Play,
  article: FileText,
  faq: HelpCircle,
  guide: BookOpen,
};

const typeEmoji: Record<ResourceType, string> = {
  video: '📹',
  article: '📄',
  faq: '❓',
  guide: '📖',
};

function getResourceIcon(resource: Resource) {
  if (resource.is_uploaded) return Paperclip;
  return typeIcons[resource.type];
}

interface ResourcePickerProps {
  resources: Resource[];
  onSelect: (resource: Resource) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ResourcePicker({ resources, onSelect, isOpen, onClose }: ResourcePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(isOpen);

  // Focus search input when picker opens
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  // Filter resources based on search
  const filteredResources = resources.filter((resource) => {
    const query = searchQuery.toLowerCase();
    return (
      resource.title.toLowerCase().includes(query) ||
      resource.description?.toLowerCase().includes(query) ||
      resource.category?.toLowerCase().includes(query)
    );
  });

  // Group resources by category
  const groupedResources = filteredResources.reduce(
    (acc, resource) => {
      const category = resource.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(resource);
      return acc;
    },
    {} as Record<string, Resource[]>
  );

  const handleResourceClick = (resource: Resource) => {
    onSelect(resource);
    setSearchQuery('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      onKeyDown={handleKeyDown}
    >
      {/* Search header */}
      <div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Resource list */}
      <div className="max-h-72 overflow-auto">
        {filteredResources.length === 0 ? (
          <div className="p-4 text-center text-sm text-zinc-500">
            {searchQuery ? 'No matching resources' : 'No resources available'}
          </div>
        ) : (
          Object.entries(groupedResources).map(([category, categoryResources]) => (
            <div key={category}>
              <div className="sticky top-0 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
                {category}
              </div>
              {categoryResources.map((resource) => {
                const TypeIcon = getResourceIcon(resource);
                return (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => handleResourceClick(resource)}
                    className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4 flex-shrink-0 text-zinc-500" />
                      <span className="font-medium text-sm truncate">{resource.title}</span>
                      {resource.is_uploaded && (
                        <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-1 py-0.5 rounded">
                          File
                        </span>
                      )}
                    </div>
                    {resource.description && (
                      <p className="mt-0.5 pl-6 text-xs text-zinc-500 line-clamp-1">
                        {resource.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function formatResourceLink(resource: Resource): string {
  // Use paperclip emoji for uploaded files, type-specific emoji for links
  const emoji = resource.is_uploaded ? '📎' : typeEmoji[resource.type];
  return `${emoji} [${resource.title}](${resource.url})`;
}
