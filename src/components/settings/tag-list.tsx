'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import { createTag, updateTag, deleteTag } from '@/lib/actions/tags';
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

interface TagListProps {
  tags: Tag[];
}

export function TagList({ tags }: TagListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [selectedColor, setSelectedColor] = useState('#6B7280');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const description = (formData.get('description') as string)?.trim() || null;

    startTransition(async () => {
      if (editingTag) {
        await updateTag({
          id: editingTag.id,
          name: formData.get('name') as string,
          color: selectedColor,
          description,
        });
      } else {
        await createTag({
          name: formData.get('name') as string,
          color: selectedColor,
          description: description || undefined,
        });
      }
      setIsDialogOpen(false);
      setEditingTag(null);
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
    setIsDialogOpen(true);
  };

  const openEditDialog = (tag: Tag) => {
    setEditingTag(tag);
    setSelectedColor(tag.color);
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-start justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex-1 min-w-0 space-y-1">
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
                {tag.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {tag.description}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEditDialog(tag)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => handleDelete(tag.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
