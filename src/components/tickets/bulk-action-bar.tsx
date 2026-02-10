'use client';

import { useState, useTransition } from 'react';
import { X, CheckCircle, UserPlus, Tag, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  bulkUpdateTicketStatus,
  bulkAssignTickets,
  bulkAddTagToTickets,
  bulkDeleteTickets,
} from '@/lib/actions/tickets';
import type { Profile, Tag as TagType, TicketStatus } from '@/lib/supabase/types';

interface SelectedTicket {
  id: string;
  subject: string;
  ticket_number: number;
}

interface BulkActionBarProps {
  selectedIds: string[];
  selectedTickets?: SelectedTicket[];
  onClearSelection: () => void;
  onActionComplete: (message: string) => void;
  agents: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  tags: TagType[];
  isAdmin?: boolean;
}

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
];

export function BulkActionBar({
  selectedIds,
  selectedTickets = [],
  onClearSelection,
  onActionComplete,
  agents,
  tags,
  isAdmin = false,
}: BulkActionBarProps) {
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleStatusChange = (status: TicketStatus) => {
    setActiveAction('status');
    startTransition(async () => {
      const result = await bulkUpdateTicketStatus(selectedIds, status);
      if ('error' in result) {
        onActionComplete(`Error: ${result.error}`);
      } else {
        onActionComplete(
          `Updated status to "${status}" for ${result.count} ticket${result.count !== 1 ? 's' : ''}`
        );
        onClearSelection();
      }
      setActiveAction(null);
    });
  };

  const handleCloseTickets = () => {
    handleStatusChange('closed');
  };

  const handleAssign = (agentId: string) => {
    setActiveAction('assign');
    startTransition(async () => {
      const result = await bulkAssignTickets(
        selectedIds,
        agentId === 'unassigned' ? null : agentId
      );
      if ('error' in result) {
        onActionComplete(`Error: ${result.error}`);
      } else {
        const agent = agents.find((a) => a.id === agentId);
        const agentName =
          agentId === 'unassigned'
            ? 'Unassigned'
            : agent?.full_name || agent?.email || 'agent';
        onActionComplete(
          `Assigned ${result.count} ticket${result.count !== 1 ? 's' : ''} to ${agentName}`
        );
        onClearSelection();
      }
      setActiveAction(null);
    });
  };

  const handleAddTag = (tagId: string) => {
    setActiveAction('tag');
    startTransition(async () => {
      const result = await bulkAddTagToTickets(selectedIds, tagId);
      if ('error' in result) {
        onActionComplete(`Error: ${result.error}`);
      } else {
        const tagName = tags.find((t) => t.id === tagId)?.name || 'tag';
        onActionComplete(
          `Added tag "${tagName}" to ${result.count} ticket${result.count !== 1 ? 's' : ''}`
        );
        onClearSelection();
      }
      setActiveAction(null);
    });
  };

  const handleDelete = () => {
    setActiveAction('delete');
    startTransition(async () => {
      const result = await bulkDeleteTickets(selectedIds);
      if ('error' in result) {
        onActionComplete(`Error: ${result.error}`);
      } else {
        onActionComplete(
          `Deleted ${result.count} ticket${result.count !== 1 ? 's' : ''}`
        );
        onClearSelection();
      }
      setActiveAction(null);
      setIsDeleteDialogOpen(false);
    });
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-r border-zinc-200 pr-3 dark:border-zinc-700">
          <span className="text-sm font-medium">
            {selectedIds.length} ticket{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClearSelection}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCloseTickets}
          disabled={isPending}
        >
          {isPending && activeAction === 'status' ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Close
        </Button>

        <Select
          onValueChange={(value) => handleStatusChange(value as TicketStatus)}
          disabled={isPending}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Change status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={handleAssign} disabled={isPending}>
          <SelectTrigger className="w-40">
            {isPending && activeAction === 'assign' ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            <SelectValue placeholder="Assign to..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.full_name || agent.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.length > 0 && (
          <Select onValueChange={handleAddTag} disabled={isPending}>
            <SelectTrigger className="w-36">
              {isPending && activeAction === 'tag' ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Tag className="mr-2 h-4 w-4" />
              )}
              <SelectValue placeholder="Add tag..." />
            </SelectTrigger>
            <SelectContent>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Delete button - admin only */}
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isPending}
            className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
          >
            {isPending && activeAction === 'delete' ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.length} ticket{selectedIds.length !== 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All messages and attachments will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          {selectedTickets.length > 0 && selectedTickets.length <= 10 && (
            <div className="max-h-40 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {selectedTickets.map((ticket) => (
                  <li key={ticket.id} className="px-3 py-2 text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">#{ticket.ticket_number}</span>{' '}
                    <span className="truncate">{ticket.subject}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedTickets.length > 10 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {selectedTickets.length} tickets selected for deletion.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending && activeAction === 'delete' ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
