'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Send, Lock, FileText, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { sendMessage } from '@/lib/actions/messages';
import {
  replaceTemplateVariables,
  type TemplateContext,
} from '@/lib/utils/template-variables';
import type { CannedResponse } from '@/lib/supabase/types';

interface TicketComposerProps {
  ticketId: string;
  cannedResponses?: CannedResponse[];
  templateContext?: TemplateContext;
}

export function TicketComposer({
  ticketId,
  cannedResponses = [],
  templateContext = {},
}: TicketComposerProps) {
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
        setSearchQuery('');
      }
    }

    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when picker opens
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen]);

  // Filter responses based on search
  const filteredResponses = cannedResponses.filter((response) => {
    const query = searchQuery.toLowerCase();
    return (
      response.title.toLowerCase().includes(query) ||
      response.content.toLowerCase().includes(query) ||
      response.shortcut?.toLowerCase().includes(query) ||
      response.category?.toLowerCase().includes(query)
    );
  });

  // Group responses by category
  const groupedResponses = filteredResponses.reduce(
    (acc, response) => {
      const category = response.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(response);
      return acc;
    },
    {} as Record<string, CannedResponse[]>
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      const result = await sendMessage({
        ticketId,
        content: content.trim(),
        isInternal,
      });

      if (!result.error) {
        setContent('');
      }
    });
  };

  const handleCannedResponse = (response: CannedResponse) => {
    // Replace template variables with actual values
    const processedContent = replaceTemplateVariables(response.content, templateContext);

    // Append to existing content or set as new content
    setContent((prev) => (prev ? `${prev}\n\n${processedContent}` : processedContent));
    setIsPickerOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsPickerOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isInternal ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsInternal(!isInternal)}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              {isInternal ? 'Internal Note' : 'Reply'}
            </Button>
          </div>

          {cannedResponses.length > 0 && (
            <div className="relative" ref={pickerRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPickerOpen(!isPickerOpen)}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Canned Responses
              </Button>

              {isPickerOpen && (
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
                        placeholder="Search responses..."
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

                  {/* Response list */}
                  <div className="max-h-72 overflow-auto">
                    {filteredResponses.length === 0 ? (
                      <div className="p-4 text-center text-sm text-zinc-500">
                        {searchQuery ? 'No matching responses' : 'No canned responses available'}
                      </div>
                    ) : (
                      Object.entries(groupedResponses).map(([category, responses]) => (
                        <div key={category}>
                          <div className="sticky top-0 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
                            {category}
                          </div>
                          {responses.map((response) => (
                            <button
                              key={response.id}
                              type="button"
                              onClick={() => handleCannedResponse(response)}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{response.title}</span>
                                {response.shortcut && (
                                  <span className="text-xs text-zinc-400 font-mono">
                                    /{response.shortcut}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">
                                {response.content}
                              </p>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isInternal ? 'Write an internal note...' : 'Write a reply...'}
          rows={4}
          className={isInternal ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/10' : ''}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending || !content.trim()}>
            <Send className="mr-2 h-4 w-4" />
            {isPending ? 'Sending...' : isInternal ? 'Add Note' : 'Send Reply'}
          </Button>
        </div>
      </div>
    </form>
  );
}
