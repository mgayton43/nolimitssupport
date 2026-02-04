'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from '@/lib/actions/canned-responses';
import { AVAILABLE_VARIABLES } from '@/lib/utils/template-variables';
import type { CannedResponse, Profile } from '@/lib/supabase/types';

interface CannedResponseListProps {
  responses: (CannedResponse & { creator: Pick<Profile, 'full_name'> | null })[];
}

export function CannedResponseList({ responses }: CannedResponseListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (editingResponse) {
        await updateCannedResponse({
          id: editingResponse.id,
          title: formData.get('title') as string,
          content: formData.get('content') as string,
          shortcut: (formData.get('shortcut') as string) || undefined,
          category: (formData.get('category') as string) || undefined,
        });
      } else {
        await createCannedResponse({
          title: formData.get('title') as string,
          content: formData.get('content') as string,
          shortcut: (formData.get('shortcut') as string) || undefined,
          category: (formData.get('category') as string) || undefined,
        });
      }
      setIsDialogOpen(false);
      setEditingResponse(null);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this canned response?')) return;
    startTransition(async () => {
      await deleteCannedResponse(id);
    });
  };

  const openCreateDialog = () => {
    setEditingResponse(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (response: CannedResponse) => {
    setEditingResponse(response);
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-medium">Template Variables</h3>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
            Use these variables in your responses. They&apos;ll be replaced with actual values when inserted.
          </p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARIABLES.map((v) => (
              <div key={v.variable} className="group relative">
                <Badge variant="secondary" className="font-mono text-xs cursor-help">
                  {v.variable}
                </Badge>
                <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10">
                  <div className="rounded bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg whitespace-nowrap dark:bg-zinc-700">
                    <p>{v.description}</p>
                    <p className="text-zinc-400">Example: {v.example}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Response
        </Button>
      </div>

      {responses.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          No canned responses yet. Create your first one.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {responses.map((response) => (
            <Card key={response.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{response.title}</CardTitle>
                    {response.shortcut && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        /{response.shortcut}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(response)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(response.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-3 whitespace-pre-wrap">
                  {response.content}
                </p>
                {response.creator && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Created by {response.creator.full_name}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingResponse ? 'Edit Canned Response' : 'Create Canned Response'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                name="title"
                defaultValue={editingResponse?.title}
                placeholder="e.g., Thank you for contacting"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="shortcut" className="text-sm font-medium">
                Shortcut (optional)
              </label>
              <Input
                id="shortcut"
                name="shortcut"
                defaultValue={editingResponse?.shortcut || ''}
                placeholder="e.g., thanks"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium">
                Category (optional)
              </label>
              <Input
                id="category"
                name="category"
                defaultValue={editingResponse?.category || ''}
                placeholder="e.g., Greetings"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="content" className="text-sm font-medium">
                Content
              </label>
              <Textarea
                id="content"
                name="content"
                defaultValue={editingResponse?.content}
                placeholder="Hi {{customer_name}}, thanks for reaching out..."
                rows={6}
                required
              />
              <p className="text-xs text-zinc-500">
                Tip: Use {'{{'}<span>customer_name</span>{'}}'},  {'{{'}<span>customer_email</span>{'}}'},  {'{{'}<span>ticket_number</span>{'}}'},  or {'{{'}<span>agent_name</span>{'}}'} for dynamic content.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : editingResponse ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
