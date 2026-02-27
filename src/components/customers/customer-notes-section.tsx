'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { StickyNote, Trash2, Send, Loader2 } from 'lucide-react';
import { createCustomerNote, deleteCustomerNote } from '@/lib/actions/customer-notes';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import type { CustomerNote } from '@/lib/supabase/types';

interface CustomerNotesSectionProps {
  customerId: string;
  initialNotes: CustomerNote[];
}

export function CustomerNotesSection({ customerId, initialNotes }: CustomerNotesSectionProps) {
  const [notes, setNotes] = useState<CustomerNote[]>(initialNotes);
  const [newNote, setNewNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || isPending) return;

    startTransition(async () => {
      const result = await createCustomerNote({
        customer_id: customerId,
        content: newNote.trim(),
      });

      if ('note' in result) {
        setNotes((prev) => [result.note, ...prev]);
        setNewNote('');
      }
    });
  };

  const handleDelete = async (noteId: string) => {
    if (deletingId) return;

    setDeletingId(noteId);
    const result = await deleteCustomerNote(noteId, customerId);

    if ('success' in result && result.success) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
    setDeletingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="h-4 w-4" />
          Internal Notes ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add an internal note about this customer..."
            className="flex-1 min-h-[80px] rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 resize-none"
            disabled={isPending}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newNote.trim() || isPending}
            className="self-end"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        {/* Notes List */}
        {notes.length > 0 ? (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar
                      src={note.author?.avatar_url}
                      fallback={getInitials(note.author?.full_name || note.author?.email || '?')}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate">
                          {note.author?.full_name || note.author?.email || 'Unknown'}
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {formatRelativeTime(note.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-zinc-400 hover:text-red-500"
                    title="Delete note"
                  >
                    {deletingId === note.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-zinc-500 dark:text-zinc-400">
            No notes yet. Add a note to keep track of important information about this customer.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
