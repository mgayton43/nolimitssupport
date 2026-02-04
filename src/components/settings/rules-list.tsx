'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createAutoTagRule,
  updateAutoTagRule,
  deleteAutoTagRule,
} from '@/lib/actions/auto-tag-rules';
import type { AutoTagRule, Tag } from '@/lib/supabase/types';

interface RulesListProps {
  rules: AutoTagRule[];
  tags: Tag[];
}

interface RuleFormData {
  name: string;
  keywords: string[];
  tag_id: string;
  match_subject: boolean;
  match_body: boolean;
  is_active: boolean;
}

const defaultFormData: RuleFormData = {
  name: '',
  keywords: [''],
  tag_id: '',
  match_subject: true,
  match_body: true,
  is_active: true,
};

function RuleForm({
  initialData,
  tags,
  onSave,
  onCancel,
  isPending,
}: {
  initialData: RuleFormData;
  tags: Tag[];
  onSave: (data: RuleFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState<RuleFormData>(initialData);

  const addKeyword = () => {
    setFormData((prev) => ({
      ...prev,
      keywords: [...prev.keywords, ''],
    }));
  };

  const removeKeyword = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((_, i) => i !== index),
    }));
  };

  const updateKeyword = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.map((k, i) => (i === index ? value : k)),
    }));
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div>
        <label className="mb-1 block text-sm font-medium">Rule Name</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Shipping Issues"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Keywords</label>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Add keywords or phrases to match (case-insensitive)
        </p>
        <div className="space-y-2">
          {formData.keywords.map((keyword, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={keyword}
                onChange={(e) => updateKeyword(index, e.target.value)}
                placeholder="e.g., shipping, lost package"
              />
              {formData.keywords.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeKeyword(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addKeyword}>
            <Plus className="mr-2 h-4 w-4" />
            Add Keyword
          </Button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Apply Tag</label>
        <Select
          value={formData.tag_id}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, tag_id: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a tag" />
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
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Match Against</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.match_subject}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, match_subject: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm">Subject</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.match_body}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, match_body: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm">Message Body</span>
          </label>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
            }
            className="h-4 w-4 rounded border-zinc-300"
          />
          <span className="text-sm font-medium">Rule is active</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={() => onSave(formData)} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Rule'}
        </Button>
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  tags,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: AutoTagRule;
  tags: Tag[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const tag = rule.tag || tags.find((t) => t.id === rule.tag_id);

  return (
    <div
      className={`rounded-lg border p-4 ${
        rule.is_active
          ? 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800'
          : 'border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-700 dark:bg-zinc-900'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{rule.name}</h3>
            {!rule.is_active && (
              <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                Disabled
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {rule.keywords.map((keyword, i) => (
              <span
                key={i}
                className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
              >
                {keyword}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1">
              <span>Tag:</span>
              {tag && (
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </span>
              )}
            </div>
            <span>•</span>
            <span>
              Matches:{' '}
              {[rule.match_subject && 'Subject', rule.match_body && 'Body']
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onToggle} title={rule.is_active ? 'Disable' : 'Enable'}>
            <Check className={`h-4 w-4 ${rule.is_active ? 'text-green-500' : 'text-zinc-400'}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RulesList({ rules, tags }: RulesListProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (data: RuleFormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createAutoTagRule({
        name: data.name,
        keywords: data.keywords.filter((k) => k.trim()),
        tag_id: data.tag_id,
        match_subject: data.match_subject,
        match_body: data.match_body,
        is_active: data.is_active,
      });

      if ('error' in result) {
        setError(result.error);
      } else {
        setIsCreating(false);
      }
    });
  };

  const handleUpdate = (id: string, data: RuleFormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateAutoTagRule({
        id,
        name: data.name,
        keywords: data.keywords.filter((k) => k.trim()),
        tag_id: data.tag_id,
        match_subject: data.match_subject,
        match_body: data.match_body,
        is_active: data.is_active,
      });

      if ('error' in result) {
        setError(result.error);
      } else {
        setEditingId(null);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    startTransition(async () => {
      const result = await deleteAutoTagRule(id);
      if ('error' in result) {
        setError(result.error);
      }
    });
  };

  const handleToggle = (rule: AutoTagRule) => {
    startTransition(async () => {
      const result = await updateAutoTagRule({
        id: rule.id,
        is_active: !rule.is_active,
      });
      if ('error' in result) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {!isCreating && (
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      )}

      {isCreating && (
        <RuleForm
          initialData={defaultFormData}
          tags={tags}
          onSave={handleCreate}
          onCancel={() => setIsCreating(false)}
          isPending={isPending}
        />
      )}

      {rules.length === 0 && !isCreating ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <p>No auto-tagging rules yet.</p>
          <p className="text-sm">Create a rule to automatically tag tickets based on keywords.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) =>
            editingId === rule.id ? (
              <RuleForm
                key={rule.id}
                initialData={{
                  name: rule.name,
                  keywords: rule.keywords.length > 0 ? rule.keywords : [''],
                  tag_id: rule.tag_id,
                  match_subject: rule.match_subject,
                  match_body: rule.match_body,
                  is_active: rule.is_active,
                }}
                tags={tags}
                onSave={(data) => handleUpdate(rule.id, data)}
                onCancel={() => setEditingId(null)}
                isPending={isPending}
              />
            ) : (
              <RuleCard
                key={rule.id}
                rule={rule}
                tags={tags}
                onEdit={() => setEditingId(rule.id)}
                onDelete={() => handleDelete(rule.id)}
                onToggle={() => handleToggle(rule)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
