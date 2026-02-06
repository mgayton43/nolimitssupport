-- Message Attachments Storage Bucket
-- ==============================================

-- Create the storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'attachments',
    'attachments',
    true,
    52428800, -- 50MB max file size
    ARRAY[
        -- Images
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        -- Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        -- Text
        'text/plain',
        'text/csv',
        'text/html',
        'text/markdown',
        -- Archives
        'application/zip',
        'application/x-zip-compressed',
        -- Other
        'application/json',
        'application/xml'
    ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments bucket
-- Anyone can view public attachments
CREATE POLICY "Public attachments are viewable by everyone"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'attachments');

-- Authenticated users can upload attachments
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments');

-- Authenticated users can delete attachments
CREATE POLICY "Authenticated users can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments');
