'use client';

import { useState, useTransition, useRef } from 'react';
import { Plus, Pencil, Trash2, Info, Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
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
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  bulkCreateCannedResponses,
  type BulkCannedResponseInput,
} from '@/lib/actions/canned-responses';
import { AVAILABLE_VARIABLES } from '@/lib/utils/template-variables';
import type { CannedResponse, Profile, Brand, Resource } from '@/lib/supabase/types';

interface CannedResponseListProps {
  responses: (CannedResponse & { creator: Pick<Profile, 'full_name' | 'email'> | null; brand?: Brand | null })[];
  brands: Brand[];
  resources?: Resource[];
}

interface ParsedRow {
  rowNum: number;
  title: string;
  content: string;
  shortcut: string;
  category: string;
  error?: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const rows: ParsedRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Parse CSV line respecting quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          j++;
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    // Skip header row if it looks like headers
    if (i === 0) {
      const firstField = fields[0]?.toLowerCase();
      if (firstField === 'title' || firstField === '"title"') {
        continue;
      }
    }

    // Skip empty rows
    if (fields.every(f => !f)) {
      continue;
    }

    const [title = '', content = '', shortcut = '', category = ''] = fields;

    const row: ParsedRow = {
      rowNum: i + 1,
      title: title.replace(/^"|"$/g, ''),
      content: content.replace(/^"|"$/g, '').replace(/""/g, '"'),
      shortcut: shortcut.replace(/^"|"$/g, ''),
      category: category.replace(/^"|"$/g, ''),
    };

    // Validate
    if (!row.title) {
      row.error = 'Missing title';
    } else if (!row.content) {
      row.error = 'Missing content';
    } else if (row.title.length > 200) {
      row.error = 'Title too long (max 200 chars)';
    }

    rows.push(row);
  }

  return rows;
}

function generateCSVTemplate(): string {
  const headers = 'title,content,shortcut,category';
  const examples = [
    '"Welcome Greeting","Hi {{customer_name}}, thanks for reaching out to NoLimits support! How can I help you today?","/welcome","Greetings"',
    '"Order Status","Hi {{customer_name}}, I\'d be happy to check on the status of your order. Could you please provide your order number?","/orderstatus","Orders"',
    '"Thank You - Resolved","Thanks for your patience, {{customer_name}}! I\'m glad we could resolve this for you. Is there anything else I can help with?","/resolved","Closing"',
  ];
  return [headers, ...examples].join('\n');
}

export function CannedResponseList({ responses, brands, resources = [] }: CannedResponseListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [editorContent, setEditorContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const brandId = formData.get('brand_id') as string;

    startTransition(async () => {
      if (editingResponse) {
        await updateCannedResponse({
          id: editingResponse.id,
          title: formData.get('title') as string,
          content: editorContent,
          shortcut: (formData.get('shortcut') as string) || undefined,
          category: (formData.get('category') as string) || undefined,
          brand_id: brandId === 'all' ? null : brandId || null,
        });
      } else {
        await createCannedResponse({
          title: formData.get('title') as string,
          content: editorContent,
          shortcut: (formData.get('shortcut') as string) || undefined,
          category: (formData.get('category') as string) || undefined,
          brand_id: brandId === 'all' ? null : brandId || null,
        });
      }
      setIsDialogOpen(false);
      setEditingResponse(null);
      setEditorContent('');
    });
  };

  // Filter responses by selected brand
  const filteredResponses = selectedBrandId === 'all'
    ? responses
    : responses.filter(r => r.brand_id === selectedBrandId || r.brand_id === null);

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this canned response?')) return;
    startTransition(async () => {
      await deleteCannedResponse(id);
    });
  };

  const openCreateDialog = () => {
    setEditingResponse(null);
    setEditorContent('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (response: CannedResponse) => {
    setEditingResponse(response);
    setEditorContent(response.content);
    setIsDialogOpen(true);
  };

  const openBulkDialog = () => {
    setParsedRows([]);
    setImportResult(null);
    setIsBulkDialogOpen(true);
  };

  const closeBulkDialog = () => {
    setIsBulkDialogOpen(false);
    setParsedRows([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'canned-responses-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const validRows = parsedRows.filter(r => !r.error);
    if (validRows.length === 0) {
      setImportResult({ success: false, message: 'No valid rows to import' });
      return;
    }

    const toImport: BulkCannedResponseInput[] = validRows.map(r => ({
      title: r.title,
      content: r.content,
      shortcut: r.shortcut || undefined,
      category: r.category || undefined,
    }));

    startTransition(async () => {
      const result = await bulkCreateCannedResponses(toImport);

      if (result.success && result.imported > 0) {
        setImportResult({
          success: true,
          message: `Successfully imported ${result.imported} response${result.imported !== 1 ? 's' : ''}${result.errors.length > 0 ? ` (${result.errors.length} skipped)` : ''}`,
        });
        // Close dialog after short delay to show success message
        setTimeout(() => {
          closeBulkDialog();
        }, 1500);
      } else {
        const errorMsg = result.errors.length > 0
          ? result.errors.map(e => `Row ${e.row}: ${e.message}`).join(', ')
          : 'Failed to import';
        setImportResult({ success: false, message: errorMsg });
      }
    });
  };

  const validCount = parsedRows.filter(r => !r.error).length;
  const errorCount = parsedRows.filter(r => r.error).length;

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
        <div className="flex gap-2">
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: brand.color }}
                    />
                    {brand.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={openBulkDialog}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Response
          </Button>
        </div>
      </div>

      {filteredResponses.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          {responses.length === 0 ? 'No canned responses yet. Create your first one.' : 'No responses match the selected filter.'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredResponses.map((response) => (
            <Card key={response.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{response.title}</CardTitle>
                      {response.brand ? (
                        <span
                          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${response.brand.color}20`,
                            color: response.brand.color,
                            border: `1px solid ${response.brand.color}40`,
                          }}
                        >
                          {response.brand.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          All Brands
                        </span>
                      )}
                    </div>
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
                    Created by {response.creator.full_name || response.creator.email}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingResponse(null);
          setEditorContent('');
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingResponse ? 'Edit Canned Response' : 'Create Canned Response'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <label htmlFor="brand_id" className="text-sm font-medium">
                  Brand
                </label>
                <Select
                  name="brand_id"
                  defaultValue={editingResponse?.brand_id || 'all'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: brand.color }}
                          />
                          {brand.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="content" className="text-sm font-medium">
                Content
              </label>
              <RichTextEditor
                id="content"
                value={editorContent}
                onChange={setEditorContent}
                placeholder="Hi {{customer_name}}, thanks for reaching out..."
                minHeight={150}
                maxHeight={300}
                showPreview={true}
                showResources={resources.length > 0}
                resources={resources}
                uploadPath="canned-responses"
                required
              />
              <p className="text-xs text-zinc-500">
                Tip: Use {'{{'}<span>customer_name</span>{'}}'},  {'{{'}<span>customer_email</span>{'}}'},  {'{{'}<span>ticket_number</span>{'}}'},  or {'{{'}<span>agent_name</span>{'}}'} for dynamic content. Use the Preview button to see how it will look.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !editorContent.trim()}>
                {isPending ? 'Saving...' : editingResponse ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={(open) => !open && closeBulkDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Import Canned Responses</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Instructions */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Upload a CSV file with columns: title, content, shortcut, category
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>

            {/* File Upload */}
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="flex items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-zinc-300 hover:border-zinc-400 cursor-pointer transition-colors dark:border-zinc-700 dark:hover:border-zinc-600"
              >
                <FileText className="h-5 w-5 text-zinc-400" />
                <span className="text-sm text-zinc-500">
                  Click to upload CSV file
                </span>
              </label>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                importResult.success
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="text-sm">{importResult.message}</span>
              </div>
            )}

            {/* Preview Table */}
            {parsedRows.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">
                    Preview ({validCount} valid, {errorCount} with errors)
                  </h4>
                </div>
                <div className="flex-1 overflow-auto border border-zinc-200 rounded-lg dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Row</th>
                        <th className="text-left p-2 font-medium">Title</th>
                        <th className="text-left p-2 font-medium">Content</th>
                        <th className="text-left p-2 font-medium">Shortcut</th>
                        <th className="text-left p-2 font-medium">Category</th>
                        <th className="text-left p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`border-t border-zinc-200 dark:border-zinc-700 ${
                            row.error ? 'bg-red-50 dark:bg-red-900/10' : ''
                          }`}
                        >
                          <td className="p-2 text-zinc-500">{row.rowNum}</td>
                          <td className="p-2 max-w-[150px] truncate">{row.title || '-'}</td>
                          <td className="p-2 max-w-[200px] truncate">{row.content || '-'}</td>
                          <td className="p-2">{row.shortcut || '-'}</td>
                          <td className="p-2">{row.category || '-'}</td>
                          <td className="p-2">
                            {row.error ? (
                              <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {row.error}
                              </span>
                            ) : (
                              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Valid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={closeBulkDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={isPending || validCount === 0}
            >
              {isPending ? 'Importing...' : `Import ${validCount} Response${validCount !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
