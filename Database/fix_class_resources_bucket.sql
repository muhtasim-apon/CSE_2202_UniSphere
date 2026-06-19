-- Create the class-resources storage bucket.
-- Run this once in the Supabase SQL Editor.
-- (The lifespan auto-creation silently fails if Supabase rejects the 2 GB limit.)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('class-resources', 'class-resources', TRUE, 52428800)
ON CONFLICT (id) DO UPDATE SET
    public         = TRUE,
    file_size_limit = 52428800;

-- Storage RLS policies
DROP POLICY IF EXISTS "class_resources_public_read"        ON storage.objects;
DROP POLICY IF EXISTS "class_resources_auth_upload"        ON storage.objects;
DROP POLICY IF EXISTS "class_resources_auth_delete"        ON storage.objects;

CREATE POLICY "class_resources_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'class-resources');

CREATE POLICY "class_resources_auth_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'class-resources');

CREATE POLICY "class_resources_auth_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'class-resources');
