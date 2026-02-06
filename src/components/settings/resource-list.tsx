'use client';

import { useState, useTransition, useRef } from 'react';
import { Plus, Pencil, Trash2, Play, FileText, HelpCircle, BookOpen, ExternalLink, Paperclip, Upload, Loader2, Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { createResource, updateResource, deleteResource, deleteResourceFile } from '@/lib/actions/resources';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import type { Resource, ResourceType, Brand } from '@/lib/supabase/types';

const resourceTypeOptions: { value: ResourceType; label: string; icon: typeof Play }[] = [
  { value: 'video', label: 'Video', icon: Play },
  { value: 'article', label: 'Article', icon: FileText },
  { value: 'faq', label: 'FAQ', icon: HelpCircle },
  { value: 'guide', label: 'Guide', icon: BookOpen },
];

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
].join(',');

function getTypeIcon(type: ResourceType, isUploaded: boolean) {
  if (isUploaded) return Paperclip;
  const option = resourceTypeOptions.find((o) => o.value === type);
  return option?.icon || FileText;
}

interface ResourceListProps {
  resources: (Resource & { brand?: Brand | null })[];
  brands: Brand[];
}

export function ResourceList({ resources, brands }: ResourceListProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [selectedType, setSelectedType] = useState<ResourceType>('article');
  const [isPending, startTransition] = useTransition();
  const [sourceMode, setSourceMode] = useState<'url' | 'upload'>('url');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter resources by selected brand
  const filteredResources = selectedBrandFilter === 'all'
    ? resources
    : resources.filter(r => r.brand_id === selectedBrandFilter || r.brand_id === null);

  // Group resources by category
  const groupedResources = filteredResources.reduce(
    (acc, resource) => {
      const category = resource.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(resource);
      return acc;
    },
    {} as Record<string, (Resource & { brand?: Brand | null })[]>
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const supabase = createClient();

      // Generate unique filename
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${timestamp}-${safeName}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from('resources')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        alert('Failed to upload file: ' + error.message);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('resources')
        .getPublicUrl(data.path);

      setUploadedFile({
        name: file.name,
        url: urlData.publicUrl,
        path: data.path,
      });
      setUploadProgress(100);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveUploadedFile = async () => {
    if (uploadedFile?.path) {
      await deleteResourceFile(uploadedFile.path);
    }
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const isUploadMode = sourceMode === 'upload';
    const url = isUploadMode ? uploadedFile?.url : (formData.get('url') as string);

    if (!url) {
      alert(isUploadMode ? 'Please upload a file first' : 'Please enter a URL');
      return;
    }

    startTransition(async () => {
      const brandId = selectedBrandId === 'all' ? null : selectedBrandId;
      if (editingResource) {
        // If switching from upload to URL, the old file will be deleted by the server action
        await updateResource({
          id: editingResource.id,
          title: formData.get('title') as string,
          description: formData.get('description') as string,
          url: url,
          type: selectedType,
          category: formData.get('category') as string,
          thumbnail_url: formData.get('thumbnail_url') as string,
          file_path: isUploadMode ? uploadedFile?.path : undefined,
          is_uploaded: isUploadMode,
          brand_id: brandId,
        });
      } else {
        await createResource({
          title: formData.get('title') as string,
          description: formData.get('description') as string,
          url: url,
          type: selectedType,
          category: formData.get('category') as string,
          thumbnail_url: formData.get('thumbnail_url') as string,
          file_path: isUploadMode ? uploadedFile?.path : undefined,
          is_uploaded: isUploadMode,
          brand_id: brandId,
        });
      }
      handleCloseDialog();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    startTransition(async () => {
      await deleteResource(id);
    });
  };

  const handleCopyLink = async (resource: Resource) => {
    try {
      await navigator.clipboard.writeText(resource.url);
      setCopiedId(resource.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = (resource: Resource) => {
    if (resource.is_uploaded) {
      // For uploaded files, trigger a download
      const link = document.createElement('a');
      link.href = resource.url;
      link.download = resource.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // For external URLs, open in new tab
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingResource(null);
    setSourceMode('url');
    setUploadedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openCreateDialog = () => {
    setEditingResource(null);
    setSelectedType('article');
    setSourceMode('url');
    setUploadedFile(null);
    setSelectedBrandId('all');
    setIsDialogOpen(true);
  };

  const openEditDialog = (resource: Resource & { brand?: Brand | null }) => {
    setEditingResource(resource);
    setSelectedType(resource.type);
    setSourceMode(resource.is_uploaded ? 'upload' : 'url');
    setSelectedBrandId(resource.brand_id || 'all');
    if (resource.is_uploaded && resource.file_path) {
      // Extract filename from path
      const filename = resource.file_path.split('-').slice(1).join('-') || resource.file_path;
      setUploadedFile({
        name: filename,
        url: resource.url,
        path: resource.file_path,
      });
    } else {
      setUploadedFile(null);
    }
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-end gap-2">
        <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter}>
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
        {isAdmin && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Resource
          </Button>
        )}
      </div>

      {filteredResources.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          {resources.length === 0 ? `No resources yet.${isAdmin ? ' Create your first one.' : ''}` : 'No resources match the selected filter.'}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedResources).map(([category, categoryResources]) => (
            <div key={category}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {category}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryResources.map((resource) => {
                  const TypeIcon = getTypeIcon(resource.type, resource.is_uploaded);
                  const isCopied = copiedId === resource.id;
                  return (
                    <div
                      key={resource.id}
                      className="group flex flex-col rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <TypeIcon className="h-4 w-4 flex-shrink-0 text-zinc-500" />
                          <span className="font-medium text-sm truncate">{resource.title}</span>
                          {resource.is_uploaded && (
                            <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                              File
                            </span>
                          )}
                          {resource.brand ? (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${resource.brand.color}20`,
                                color: resource.brand.color,
                                border: `1px solid ${resource.brand.color}40`,
                              }}
                            >
                              {resource.brand.name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              All
                            </span>
                          )}
                        </div>
                      </div>
                      {resource.description && (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          {resource.description}
                        </p>
                      )}
                      {/* Action buttons */}
                      <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                        {/* Quick actions - visible on hover */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 relative"
                            onClick={() => handleCopyLink(resource)}
                            title="Copy link"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {isCopied && (
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap dark:bg-zinc-100 dark:text-zinc-900">
                                Copied!
                              </span>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleDownload(resource)}
                            title={resource.is_uploaded ? 'Download file' : 'Open link'}
                          >
                            {resource.is_uploaded ? (
                              <Download className="h-3.5 w-3.5" />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                        {/* Spacer */}
                        <div className="flex-1" />
                        {/* Admin actions */}
                        {isAdmin && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => openEditDialog(resource)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-500 hover:text-red-600"
                              onClick={() => handleDelete(resource.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingResource ? 'Edit Resource' : 'Create Resource'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                name="title"
                defaultValue={editingResource?.title}
                placeholder="e.g., Getting Started Guide"
                required
              />
            </div>

            {/* Source Mode Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Source</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={sourceMode === 'url' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceMode('url')}
                  className="flex-1"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Link to URL
                </Button>
                <Button
                  type="button"
                  variant={sourceMode === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceMode('upload')}
                  className="flex-1"
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload File
                </Button>
              </div>
            </div>

            {/* URL Input */}
            {sourceMode === 'url' && (
              <div className="space-y-2">
                <label htmlFor="url" className="text-sm font-medium">
                  URL
                </label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  defaultValue={editingResource?.is_uploaded ? '' : editingResource?.url}
                  placeholder="https://..."
                  required={sourceMode === 'url'}
                />
              </div>
            )}

            {/* File Upload */}
            {sourceMode === 'upload' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">File</label>
                {uploadedFile ? (
                  <div className="flex items-center gap-2 p-3 rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <Paperclip className="h-4 w-4 text-zinc-500" />
                    <span className="flex-1 text-sm truncate">{uploadedFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-500 hover:text-red-600"
                      onClick={handleRemoveUploadedFile}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_FILE_TYPES}
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className={`flex items-center justify-center gap-2 p-6 rounded-md border-2 border-dashed cursor-pointer transition-colors ${
                        isUploading
                          ? 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800'
                          : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
                      }`}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                          <span className="text-sm text-zinc-500">Uploading... {uploadProgress}%</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-zinc-400" />
                          <span className="text-sm text-zinc-500">
                            Click to upload PDF, image, or document
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="type" className="text-sm font-medium">
                Type
              </label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ResourceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resourceTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium">
                Category
              </label>
              <Input
                id="category"
                name="category"
                defaultValue={editingResource?.category || ''}
                placeholder="e.g., Onboarding"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Brand</label>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
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
              <p className="text-xs text-zinc-500">
                Select a brand to restrict this resource, or &quot;All Brands&quot; for universal use.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                name="description"
                defaultValue={editingResource?.description || ''}
                placeholder="Brief description of the resource..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="thumbnail_url" className="text-sm font-medium">
                Thumbnail URL (optional)
              </label>
              <Input
                id="thumbnail_url"
                name="thumbnail_url"
                type="url"
                defaultValue={editingResource?.thumbnail_url || ''}
                placeholder="https://..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || isUploading}>
                {isPending ? 'Saving...' : editingResource ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
