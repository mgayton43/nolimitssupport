-- Add file upload support to resources table
ALTER TABLE resources
ADD COLUMN file_path TEXT,
ADD COLUMN is_uploaded BOOLEAN DEFAULT FALSE;

-- Create storage bucket for resource files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resources',
    'resources',
    true,
    52428800, -- 50MB limit
    ARRAY[
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
        'text/csv'
    ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies: All authenticated users can read
CREATE POLICY "Authenticated users can read resource files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resources');

-- Only admins can upload files
CREATE POLICY "Admins can upload resource files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resources'
    AND (SELECT get_user_role()) = 'admin'
);

-- Only admins can update files
CREATE POLICY "Admins can update resource files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'resources'
    AND (SELECT get_user_role()) = 'admin'
);

-- Only admins can delete files
CREATE POLICY "Admins can delete resource files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'resources'
    AND (SELECT get_user_role()) = 'admin'
);
