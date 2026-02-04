'use client';

import { useState, useTransition } from 'react';
import { X, CheckCircle, UserPlus, Tag, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  bulkUpdateTicketStatus,
  bulkAssignTickets,
  bulkAddTagToTickets,
} from '@/lib/actions/tickets';
import type { Profile, Tag as TagType, TicketStatus } from '@/lib/supabase/types';

interface BulkActionBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: (message: string) => void;
  agents: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  tags: TagType[];
}

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
];

export function BulkActionBar({
  selectedIds,
  onClearSelection,
  onActionComplete,
  agents,
  tags,
}: BulkActionBarProps) {
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);

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
        const agentName =
          agentId === 'unassigned'
            ? 'Unassigned'
            : agents.find((a) => a.id === agentId)?.full_name || 'agent';
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
      </div>
    </div>
  );
}
