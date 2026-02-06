'use client';

import { useState, useRef, useTransition } from 'react';
import {
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  importTickets,
  previewImportCount,
  type GorgiasTicketRow,
  type GorgiasMessage,
  type ImportOptions,
  type ImportResult,
  type ImportError,
} from '@/lib/actions/import';
import type { Brand } from '@/lib/supabase/types';

interface ImportWizardProps {
  brands: Brand[];
}

type Step = 1 | 2 | 3 | 4;

// Default field mappings for Gorgias export
const DEFAULT_FIELD_MAPPINGS: Record<string, string> = {
  'id': 'externalId',
  'ticket_id': 'externalId',
  'external_id': 'externalId',
  'subject': 'subject',
  'title': 'subject',
  'status': 'status',
  'priority': 'priority',
  'customer_email': 'customerEmail',
  'customer email': 'customerEmail',
  'email': 'customerEmail',
  'from': 'customerEmail',
  'customer_name': 'customerName',
  'customer name': 'customerName',
  'name': 'customerName',
  'assignee_email': 'assigneeEmail',
  'assignee email': 'assigneeEmail',
  'assigned_to': 'assigneeEmail',
  'assignee': 'assigneeEmail',
  'tags': 'tags',
  'labels': 'tags',
  'created_at': 'createdAt',
  'created': 'createdAt',
  'date': 'createdAt',
  'channel': 'channel',
  'source': 'channel',
  'via': 'channel',
  'messages': 'messages',
  'conversation': 'messages',
  'body': 'messages',
};

const TARGET_FIELDS = [
  { value: 'externalId', label: 'External ID (Gorgias ticket ID)' },
  { value: 'subject', label: 'Subject' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'customerEmail', label: 'Customer Email' },
  { value: 'customerName', label: 'Customer Name' },
  { value: 'assigneeEmail', label: 'Assignee Email' },
  { value: 'tags', label: 'Tags' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'channel', label: 'Channel' },
  { value: 'messages', label: 'Messages/Conversation' },
  { value: '_skip', label: '(Skip this column)' },
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n');
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }

  const headers = result[0] || [];
  const rows = result.slice(1);

  return { headers, rows };
}

function parseMessages(content: string): GorgiasMessage[] {
  if (!content) return [];

  // Try to parse as JSON first (some exports use JSON)
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map(msg => ({
        senderType: msg.sender_type === 'agent' ? 'agent' : 'customer',
        senderEmail: msg.sender_email || msg.from || '',
        content: msg.body || msg.content || msg.text || '',
        createdAt: msg.created_at || msg.date || '',
        isInternal: msg.is_internal || msg.internal || false,
      }));
    }
  } catch {
    // Not JSON, try to parse as text
  }

  // If it's plain text, treat it as a single customer message
  if (content.trim()) {
    return [{
      senderType: 'customer',
      senderEmail: '',
      content: content.trim(),
      createdAt: '',
      isInternal: false,
    }];
  }

  return [];
}

function applyMapping(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>
): GorgiasTicketRow[] {
  return rows.map(row => {
    const ticket: Partial<GorgiasTicketRow> = {
      externalId: '',
      subject: '',
      status: 'open',
      priority: 'medium',
      customerEmail: '',
      customerName: '',
      assigneeEmail: '',
      tags: '',
      createdAt: '',
      channel: '',
      messages: [],
    };

    headers.forEach((header, index) => {
      const targetField = mapping[header];
      const value = row[index] || '';

      if (targetField && targetField !== '_skip') {
        if (targetField === 'messages') {
          ticket.messages = parseMessages(value);
        } else {
          (ticket as Record<string, unknown>)[targetField] = value;
        }
      }
    });

    return ticket as GorgiasTicketRow;
  });
}

export function ImportWizard({ brands }: ImportWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();

  // Step 1: Upload state
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const ticketFileRef = useRef<HTMLInputElement>(null);
  const messageFileRef = useRef<HTMLInputElement>(null);

  // Step 2: Mapping state
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  // Step 3: Filter state
  const [onlyOpenPending, setOnlyOpenPending] = useState(true);
  const [includeClosedDays, setIncludeClosedDays] = useState<number | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('none');
  const [previewCount, setPreviewCount] = useState<{ total: number; toImport: number; alreadyImported: number } | null>(null);

  // Step 4: Import state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Handle ticket file upload
  const handleTicketFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTicketFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-detect field mappings
      const autoMapping: Record<string, string> = {};
      headers.forEach(header => {
        const normalizedHeader = header.toLowerCase().trim();
        if (DEFAULT_FIELD_MAPPINGS[normalizedHeader]) {
          autoMapping[header] = DEFAULT_FIELD_MAPPINGS[normalizedHeader];
        }
      });
      setFieldMapping(autoMapping);
    };
    reader.readAsText(file);
  };

  // Handle message file upload (optional)
  const handleMessageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessageFile(file);
    // TODO: Parse and merge message data
  };

  // Update mapping for a header
  const updateMapping = (header: string, targetField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [header]: targetField,
    }));
  };

  // Get parsed tickets with current mapping
  const getParsedTickets = (): GorgiasTicketRow[] => {
    return applyMapping(csvRows, csvHeaders, fieldMapping);
  };

  // Get import options
  const getImportOptions = (): ImportOptions => ({
    brandId: selectedBrandId === 'none' ? null : selectedBrandId,
    onlyOpenPending,
    includeClosedDays,
    fieldMapping,
  });

  // Update preview count when filters change
  const updatePreviewCount = async () => {
    const tickets = getParsedTickets();
    const options = getImportOptions();
    const count = await previewImportCount(tickets, options);
    setPreviewCount(count);
  };

  // Handle step navigation
  const goToStep = (newStep: Step) => {
    if (newStep === 3) {
      // Update preview count when entering step 3
      updatePreviewCount();
    }
    setStep(newStep);
  };

  // Handle import
  const handleImport = () => {
    setIsImporting(true);
    setImportProgress(0);

    const tickets = getParsedTickets();
    const options = getImportOptions();

    // Simulate progress (actual import is synchronous on server)
    const progressInterval = setInterval(() => {
      setImportProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    startTransition(async () => {
      const result = await importTickets(tickets, options);
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setIsImporting(false);
    });
  };

  // Download error report as CSV
  const downloadErrorReport = () => {
    if (!importResult?.errors.length) return;

    const csv = [
      'Row,External ID,Error',
      ...importResult.errors.map(e =>
        `${e.row},"${e.externalId}","${e.error.replace(/"/g, '""')}"`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset wizard
  const resetWizard = () => {
    setStep(1);
    setTicketFile(null);
    setMessageFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setFieldMapping({});
    setOnlyOpenPending(true);
    setIncludeClosedDays(null);
    setSelectedBrandId('none');
    setPreviewCount(null);
    setImportResult(null);
    setImportProgress(0);
    if (ticketFileRef.current) ticketFileRef.current.value = '';
    if (messageFileRef.current) messageFileRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-medium ${
                s < step
                  ? 'border-green-500 bg-green-500 text-white'
                  : s === step
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-zinc-300 text-zinc-400 dark:border-zinc-600'
              }`}
            >
              {s < step ? <Check className="h-5 w-5" /> : s}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                s <= step ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
              }`}
            >
              {s === 1 && 'Upload'}
              {s === 2 && 'Map Fields'}
              {s === 3 && 'Filter'}
              {s === 4 && 'Import'}
            </span>
            {s < 4 && (
              <div
                className={`mx-4 h-0.5 w-16 ${
                  s < step ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Gorgias Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border-2 border-dashed border-zinc-300 p-6 dark:border-zinc-700">
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
                  <Upload className="h-8 w-8 text-zinc-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-medium">Upload Tickets CSV</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Export from Gorgias: Settings → Data → Export → Tickets
                  </p>
                </div>
                <input
                  ref={ticketFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleTicketFileUpload}
                  className="hidden"
                  id="ticket-file"
                />
                <Button
                  variant="outline"
                  onClick={() => ticketFileRef.current?.click()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Select CSV File
                </Button>
                {ticketFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    {ticketFile.name} ({csvRows.length} rows)
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <h4 className="font-medium mb-2">Messages CSV (Optional)</h4>
              <p className="text-sm text-zinc-500 mb-3">
                If Gorgias exports messages separately, upload that file here.
              </p>
              <input
                ref={messageFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleMessageFileUpload}
                className="hidden"
                id="message-file"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => messageFileRef.current?.click()}
              >
                <FileText className="mr-2 h-4 w-4" />
                Select Messages CSV
              </Button>
              {messageFile && (
                <span className="ml-2 text-sm text-zinc-500">{messageFile.name}</span>
              )}
            </div>

            {/* Preview */}
            {csvRows.length > 0 && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                  <h4 className="font-medium text-sm">Preview (first 5 rows)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-100 dark:bg-zinc-800">
                      <tr>
                        {csvHeaders.map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 max-w-48 truncate">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => goToStep(2)}
                disabled={csvRows.length === 0}
              >
                Next: Map Fields
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Fields */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Map Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-zinc-500">
              Match your Gorgias columns to the corresponding fields. We&apos;ve auto-detected
              common mappings.
            </p>

            <div className="space-y-3">
              {csvHeaders.map((header) => (
                <div
                  key={header}
                  className="flex items-center gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div className="w-1/3">
                    <span className="font-medium text-sm">{header}</span>
                    <p className="text-xs text-zinc-500 truncate">
                      {csvRows[0]?.[csvHeaders.indexOf(header)] || '-'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                  <div className="flex-1">
                    <Select
                      value={fieldMapping[header] || '_skip'}
                      onValueChange={(value) => updateMapping(header, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => goToStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => goToStep(3)}>
                Next: Filter
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Filter */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Filter & Configure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={onlyOpenPending}
                  onChange={(e) => {
                    setOnlyOpenPending(e.target.checked);
                    setTimeout(updatePreviewCount, 0);
                  }}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span>Import only open and pending tickets</span>
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={includeClosedDays !== null}
                  onChange={(e) => {
                    setIncludeClosedDays(e.target.checked ? 30 : null);
                    setTimeout(updatePreviewCount, 0);
                  }}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span>Include closed tickets from the last</span>
                <Input
                  type="number"
                  min="1"
                  value={includeClosedDays || ''}
                  onChange={(e) => {
                    setIncludeClosedDays(e.target.value ? parseInt(e.target.value) : null);
                    setTimeout(updatePreviewCount, 0);
                  }}
                  disabled={includeClosedDays === null}
                  className="w-20"
                />
                <span>days</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to Brand</label>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No brand (leave unassigned)</SelectItem>
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

            {previewCount && (
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">
                    Ready to import {previewCount.toImport} tickets
                  </span>
                </div>
                <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                  {previewCount.total} total in file
                  {previewCount.alreadyImported > 0 && (
                    <>, {previewCount.alreadyImported} already imported</>
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => goToStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => goToStep(4)}>
                Next: Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Import */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!importResult ? (
              <>
                <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                  <h4 className="font-medium mb-3">Import Summary</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Source file:</dt>
                      <dd>{ticketFile?.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Tickets to import:</dt>
                      <dd className="font-medium">{previewCount?.toImport || 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Brand:</dt>
                      <dd>
                        {selectedBrandId === 'none'
                          ? 'Unassigned'
                          : brands.find(b => b.id === selectedBrandId)?.name}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Filters:</dt>
                      <dd>
                        {onlyOpenPending && 'Open/Pending only'}
                        {includeClosedDays && `, Closed (last ${includeClosedDays} days)`}
                      </dd>
                    </div>
                  </dl>
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Importing tickets...</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => goToStep(3)}
                    disabled={isImporting}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || !previewCount?.toImport}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Start Import
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Import results */}
                <div
                  className={`rounded-lg p-4 ${
                    importResult.errors.length === 0
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-yellow-50 dark:bg-yellow-900/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {importResult.errors.length === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    <span className="font-medium">
                      Import {importResult.errors.length === 0 ? 'Complete' : 'Completed with Errors'}
                    </span>
                  </div>
                </div>

                <dl className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <dt className="text-zinc-500">Tickets imported:</dt>
                    <dd className="font-medium">{importResult.ticketsImported}</dd>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <dt className="text-zinc-500">Customers created:</dt>
                    <dd className="font-medium">{importResult.customersCreated}</dd>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <dt className="text-zinc-500">Tags created:</dt>
                    <dd className="font-medium">{importResult.tagsCreated}</dd>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <dt className="text-zinc-500">Failed rows:</dt>
                      <dd className="font-medium text-red-600">{importResult.errors.length}</dd>
                    </div>
                  )}
                </dl>

                {importResult.errors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Errors</h4>
                      <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Error Report
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Row</th>
                            <th className="px-3 py-2 text-left">External ID</th>
                            <th className="px-3 py-2 text-left">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.errors.slice(0, 20).map((error, i) => (
                            <tr
                              key={i}
                              className="border-t border-zinc-200 dark:border-zinc-700"
                            >
                              <td className="px-3 py-2">{error.row}</td>
                              <td className="px-3 py-2">{error.externalId || '-'}</td>
                              <td className="px-3 py-2 text-red-600 dark:text-red-400">
                                {error.error}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importResult.errors.length > 20 && (
                        <div className="px-3 py-2 text-sm text-zinc-500 border-t">
                          ... and {importResult.errors.length - 20} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetWizard}>
                    Import More
                  </Button>
                  <a href="/tickets">
                    <Button>View Tickets</Button>
                  </a>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
