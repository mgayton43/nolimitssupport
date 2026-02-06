'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createAutoPriorityRule,
  updateAutoPriorityRule,
  deleteAutoPriorityRule,
  toggleAutoPriorityRule,
  type AutoPriorityRule,
} from '@/lib/actions/auto-priority-rules';
import type { TicketPriority } from '@/lib/supabase/types';

interface PriorityRulesListProps {
  rules: AutoPriorityRule[];
}

const priorityColors: Record<TicketPriority, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const priorityLabels: Record<TicketPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function PriorityRulesList({ rules: initialRules }: PriorityRulesListProps) {
  const [rules, setRules] = useState(initialRules);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoPriorityRule | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['']);
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [matchSubject, setMatchSubject] = useState(true);
  const [matchBody, setMatchBody] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setKeywords(['']);
    setPriority('medium');
    setMatchSubject(true);
    setMatchBody(true);
    setError(null);
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: AutoPriorityRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setKeywords(rule.keywords.length > 0 ? rule.keywords : ['']);
    setPriority(rule.priority);
    setMatchSubject(rule.match_subject);
    setMatchBody(rule.match_body);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleAddKeyword = () => {
    setKeywords([...keywords, '']);
  };

  const handleRemoveKeyword = (index: number) => {
    if (keywords.length > 1) {
      setKeywords(keywords.filter((_, i) => i !== index));
    }
  };

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };

  const handleSubmit = () => {
    const filteredKeywords = keywords.filter((k) => k.trim());

    if (!name.trim()) {
      setError('Rule name is required');
      return;
    }

    if (filteredKeywords.length === 0) {
      setError('At least one keyword is required');
      return;
    }

    if (!matchSubject && !matchBody) {
      setError('At least one match field must be selected');
      return;
    }

    startTransition(async () => {
      if (editingRule) {
        const result = await updateAutoPriorityRule({
          id: editingRule.id,
          name,
          keywords: filteredKeywords,
          priority,
          match_subject: matchSubject,
          match_body: matchBody,
        });

        if ('error' in result) {
          setError(result.error);
        } else {
          setRules((prev) =>
            prev
              .map((r) => (r.id === editingRule.id ? result.rule : r))
              .sort((a, b) => {
                const order: Record<TicketPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
                return order[b.priority] - order[a.priority];
              })
          );
          setIsDialogOpen(false);
          resetForm();
        }
      } else {
        const result = await createAutoPriorityRule({
          name,
          keywords: filteredKeywords,
          priority,
          match_subject: matchSubject,
          match_body: matchBody,
        });

        if ('error' in result) {
          setError(result.error);
        } else {
          setRules((prev) =>
            [...prev, result.rule].sort((a, b) => {
              const order: Record<TicketPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
              return order[b.priority] - order[a.priority];
            })
          );
          setIsDialogOpen(false);
          resetForm();
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    startTransition(async () => {
      const result = await deleteAutoPriorityRule(id);
      if (!('error' in result)) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
    });
  };

  const handleToggle = (id: string, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleAutoPriorityRule(id, isActive);
      if (!('error' in result)) {
        setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)));
      }
    });
  };

  // Group rules by priority
  const rulesByPriority = rules.reduce(
    (acc, rule) => {
      if (!acc[rule.priority]) acc[rule.priority] = [];
      acc[rule.priority].push(rule);
      return acc;
    },
    {} as Record<TicketPriority, AutoPriorityRule[]>
  );

  const priorityOrder: TicketPriority[] = ['urgent', 'high', 'medium', 'low'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Auto-Priority Rules</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Automatically set ticket priority based on keywords in subject or message body.
            Higher priority rules win when multiple rules match.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">No auto-priority rules configured.</p>
            <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {priorityOrder.map((priorityLevel) => {
            const priorityRules = rulesByPriority[priorityLevel];
            if (!priorityRules || priorityRules.length === 0) return null;

            return (
              <div key={priorityLevel}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  <Badge className={priorityColors[priorityLevel]}>
                    {priorityLabels[priorityLevel]}
                  </Badge>
                  Priority Rules
                </h3>
                <div className="space-y-3">
                  {priorityRules.map((rule) => (
                    <Card
                      key={rule.id}
                      className={!rule.is_active ? 'opacity-60' : ''}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-base">{rule.name}</CardTitle>
                            {!rule.is_active && (
                              <Badge variant="secondary" className="text-xs">
                                Disabled
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.is_active}
                              onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                              disabled={isPending}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(rule)}
                              disabled={isPending}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(rule.id)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {rule.keywords.map((keyword, i) => (
                            <Badge key={i} variant="secondary" className="font-mono text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Matches:{' '}
                          {[
                            rule.match_subject && 'Subject',
                            rule.match_body && 'Message body',
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Auto-Priority Rule'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Rule Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Urgent - Broken Product"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Priority Level</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Urgent
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Low
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Keywords</label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                If any of these keywords appear, this rule will match (case-insensitive)
              </p>
              <div className="space-y-2">
                {keywords.map((keyword, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={keyword}
                      onChange={(e) => handleKeywordChange(index, e.target.value)}
                      placeholder="Enter keyword..."
                    />
                    {keywords.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveKeyword(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={handleAddKeyword}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Keyword
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Match Against</label>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={matchSubject}
                    onChange={(e) => setMatchSubject(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  <span className="text-sm">Ticket subject</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={matchBody}
                    onChange={(e) => setMatchBody(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  <span className="text-sm">Message body</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
