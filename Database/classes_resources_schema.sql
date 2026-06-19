-- ============================================================
-- CLASSES RESOURCES SCHEMA — EduHub University ERP (Supabase)
-- Run AFTER: classes_exam_schema.sql
-- References: instructor, student, manual_course, manual_enrollment
-- ============================================================


-- ============================================================
-- PART A: ADD join_link_token TO manual_course
-- ============================================================
-- FD: manual_course_id → join_link_token; join_link_token → manual_course_id
-- (candidate key). ✓ BCNF.

ALTER TABLE public.manual_course
    ADD COLUMN IF NOT EXISTS join_link_token VARCHAR(32)
        DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill any rows that already exist without a token
UPDATE public.manual_course
   SET join_link_token = encode(gen_random_bytes(16), 'hex')
 WHERE join_link_token IS NULL;

ALTER TABLE public.manual_course
    ALTER COLUMN join_link_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_course_join_token
    ON public.manual_course(join_link_token);

COMMENT ON COLUMN public.manual_course.join_link_token IS
    'URL-safe hex token for shareable join link. Unique per course, immutable after creation.';


-- ============================================================
-- PART B: COURSE INVITES
-- ============================================================
-- Teacher sends a direct invite to a specific student.
-- FD: invite_id → all columns. ✓ BCNF.
-- One active invite per (manual_course_id, student_id) pair —
-- enforced by UNIQUE constraint; UPSERT updates it on resend.

CREATE TABLE IF NOT EXISTS public.course_invite (
    invite_id        SERIAL PRIMARY KEY,
    manual_course_id INT NOT NULL
                         REFERENCES public.manual_course(manual_course_id)
                         ON DELETE CASCADE ON UPDATE CASCADE,
    student_id       INT NOT NULL
                         REFERENCES public.student(student_id)
                         ON DELETE CASCADE ON UPDATE CASCADE,
    invited_by       INT NOT NULL
                         REFERENCES public.instructor(instructor_id)
                         ON DELETE RESTRICT ON UPDATE CASCADE,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'accepted', 'dismissed')),
    message          VARCHAR(500),
    sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at     TIMESTAMPTZ,
    UNIQUE (manual_course_id, student_id)
);

COMMENT ON TABLE public.course_invite IS
    'Teacher-initiated invite to a student. One row per course-student pair; UPSERT on resend.';

CREATE INDEX IF NOT EXISTS idx_invite_student        ON public.course_invite(student_id);
CREATE INDEX IF NOT EXISTS idx_invite_course         ON public.course_invite(manual_course_id);
CREATE INDEX IF NOT EXISTS idx_invite_student_pending
    ON public.course_invite(student_id, status) WHERE status = 'pending';


-- ============================================================
-- PART C: COURSE RESOURCES
-- ============================================================
-- Teacher uploads files or links for students.
-- FD: resource_id → all columns. No transitive deps. ✓ BCNF.

CREATE TABLE IF NOT EXISTS public.course_resource (
    resource_id      SERIAL PRIMARY KEY,
    manual_course_id INT NOT NULL
                         REFERENCES public.manual_course(manual_course_id)
                         ON DELETE CASCADE ON UPDATE CASCADE,
    uploaded_by      INT NOT NULL
                         REFERENCES public.instructor(instructor_id)
                         ON DELETE RESTRICT ON UPDATE CASCADE,
    title            VARCHAR(500) NOT NULL,
    description      TEXT,
    resource_type    VARCHAR(20) NOT NULL
                         CHECK (resource_type IN (
                             'pdf', 'image', 'video', 'audio',
                             'document', 'presentation',
                             'drive_link', 'external_link', 'other'
                         )),
    -- Uploaded file fields (Supabase Storage bucket "class-resources"):
    file_url         VARCHAR(1000),
    file_name        VARCHAR(500),
    file_size_bytes  BIGINT CHECK (file_size_bytes >= 0),
    mime_type        VARCHAR(100),
    storage_path     VARCHAR(1000),
    -- Link-type resources:
    external_url     VARCHAR(1000),
    -- Metadata:
    is_published     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order       INT NOT NULL DEFAULT 0,
    download_count   INT NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.course_resource.file_size_bytes IS
    'Up to 2 GB (2147483648 bytes) — enforced at application layer.';

CREATE INDEX IF NOT EXISTS idx_resource_course    ON public.course_resource(manual_course_id);
CREATE INDEX IF NOT EXISTS idx_resource_type      ON public.course_resource(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_published ON public.course_resource(manual_course_id, is_published);

CREATE TRIGGER trg_resource_updated_at
    BEFORE UPDATE ON public.course_resource
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- PART D: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.course_invite   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_resource ENABLE ROW LEVEL SECURITY;

-- course_invite: invited student OR inviting instructor can read/update
CREATE POLICY "ci_select" ON public.course_invite FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.student s
                WHERE s.student_id = course_invite.student_id AND s.profile_id = auth.uid())
        OR
        EXISTS (SELECT 1 FROM public.instructor i
                WHERE i.instructor_id = course_invite.invited_by AND i.profile_id = auth.uid())
    );

CREATE POLICY "ci_insert" ON public.course_invite FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.instructor i
                WHERE i.instructor_id = course_invite.invited_by AND i.profile_id = auth.uid())
    );

CREATE POLICY "ci_update" ON public.course_invite FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.student s
                WHERE s.student_id = course_invite.student_id AND s.profile_id = auth.uid())
        OR
        EXISTS (SELECT 1 FROM public.instructor i
                WHERE i.instructor_id = course_invite.invited_by AND i.profile_id = auth.uid())
    );

-- course_resource: instructor who owns the course OR enrolled active student can read
CREATE POLICY "cr_select" ON public.course_resource FOR SELECT TO authenticated
    USING (
        is_published = TRUE AND (
            EXISTS (SELECT 1 FROM public.instructor i
                    WHERE i.instructor_id = course_resource.uploaded_by AND i.profile_id = auth.uid())
            OR
            EXISTS (
                SELECT 1 FROM public.manual_enrollment me
                JOIN public.student s ON s.student_id = me.student_id
                WHERE me.manual_course_id = course_resource.manual_course_id
                  AND s.profile_id = auth.uid() AND me.is_active = TRUE
            )
        )
    );

CREATE POLICY "cr_insert" ON public.course_resource FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.instructor i
                WHERE i.instructor_id = course_resource.uploaded_by AND i.profile_id = auth.uid())
    );

CREATE POLICY "cr_update" ON public.course_resource FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.instructor i
                WHERE i.instructor_id = course_resource.uploaded_by AND i.profile_id = auth.uid())
    );

CREATE POLICY "cr_delete" ON public.course_resource FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.instructor i
                WHERE i.instructor_id = course_resource.uploaded_by AND i.profile_id = auth.uid())
    );

-- Allow instructor to remove students (DELETE on manual_enrollment)
DROP POLICY IF EXISTS "me_delete" ON public.manual_enrollment;
CREATE POLICY "me_delete" ON public.manual_enrollment FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.manual_course mc
            JOIN public.instructor i ON i.instructor_id = mc.instructor_id
            WHERE mc.manual_course_id = manual_enrollment.manual_course_id
              AND i.profile_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.student s
            WHERE s.student_id = manual_enrollment.student_id AND s.profile_id = auth.uid()
        )
    );


-- ============================================================
-- PART E: GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON public.course_invite   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_resource TO authenticated;
GRANT DELETE ON public.manual_enrollment TO authenticated;

GRANT ALL ON public.course_invite, public.course_resource TO service_role;

GRANT USAGE, SELECT ON SEQUENCE
    public.course_invite_invite_id_seq,
    public.course_resource_resource_id_seq
    TO authenticated;
