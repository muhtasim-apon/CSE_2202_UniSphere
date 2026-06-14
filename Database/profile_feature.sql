-- ================================================================
-- UNIVERSITY ERP — PROFILE FEATURE (Student & Instructor)
-- Run this AFTER authentication.sql has already been applied.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / guarded DO blocks).
-- ================================================================


-- ================================================================
-- 1. PROFILE PHOTO COLUMNS
-- ================================================================

ALTER TABLE public.student
    ADD COLUMN IF NOT EXISTS profile_photo TEXT
        CHECK (profile_photo IS NULL OR profile_photo ~ '^https?://.{3,}');

ALTER TABLE public.instructor
    ADD COLUMN IF NOT EXISTS profile_photo TEXT
        CHECK (profile_photo IS NULL OR profile_photo ~ '^https?://.{3,}');


-- ================================================================
-- 2. GUARD TRIGGERS — lock administrative/system-managed fields
--    Self-service profile updates (via anon/authenticated key) cannot
--    change these columns. Backend writes via the service_role key
--    (auth.role() = 'service_role') bypass this guard.
-- ================================================================

CREATE OR REPLACE FUNCTION public.enforce_student_profile_restrictions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF NEW.profile_id      IS DISTINCT FROM OLD.profile_id
       OR NEW.program_id        <> OLD.program_id
       OR NEW.student_roll      <> OLD.student_roll
       OR NEW.batch_year        <> OLD.batch_year
       OR NEW.current_semester  <> OLD.current_semester
       OR NEW.cgpa              <> OLD.cgpa
       OR NEW.total_credits     <> OLD.total_credits
       OR NEW.is_active         <> OLD.is_active
    THEN
        RAISE EXCEPTION 'PROFILE_FIELD_LOCKED: cannot modify restricted student fields';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_profile_guard ON public.student;
CREATE TRIGGER trg_student_profile_guard
    BEFORE UPDATE ON public.student
    FOR EACH ROW EXECUTE FUNCTION public.enforce_student_profile_restrictions();


CREATE OR REPLACE FUNCTION public.enforce_instructor_profile_restrictions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF NEW.profile_id   IS DISTINCT FROM OLD.profile_id
       OR NEW.dept_id        <> OLD.dept_id
       OR NEW.employee_id    <> OLD.employee_id
       OR NEW.hire_date      <> OLD.hire_date
       OR NEW.designation    <> OLD.designation
       OR NEW.is_active      <> OLD.is_active
    THEN
        RAISE EXCEPTION 'PROFILE_FIELD_LOCKED: cannot modify restricted instructor fields';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instructor_profile_guard ON public.instructor;
CREATE TRIGGER trg_instructor_profile_guard
    BEFORE UPDATE ON public.instructor
    FOR EACH ROW EXECUTE FUNCTION public.enforce_instructor_profile_restrictions();


-- ================================================================
-- 3. RLS — allow owners to UPDATE their own student/instructor row
--    (authentication.sql only granted SELECT on these tables)
-- ================================================================

DROP POLICY IF EXISTS "student_own_update" ON public.student;
CREATE POLICY "student_own_update"
    ON public.student FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "instructor_own_update" ON public.instructor;
CREATE POLICY "instructor_own_update"
    ON public.instructor FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());


-- ================================================================
-- 4. SYNC TRIGGERS — keep public.profiles (used by dashboard header)
--    in sync with the student/instructor "source of truth" fields.
-- ================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_from_student()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.profiles
    SET first_name = NEW.first_name,
        last_name  = NEW.last_name,
        avatar_url = NEW.profile_photo
    WHERE id = NEW.profile_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_sync_profile ON public.student;
CREATE TRIGGER trg_student_sync_profile
    AFTER UPDATE OF first_name, last_name, profile_photo ON public.student
    FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_student();


CREATE OR REPLACE FUNCTION public.sync_profile_from_instructor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.profiles
    SET first_name = NEW.first_name,
        last_name  = NEW.last_name,
        avatar_url = NEW.profile_photo
    WHERE id = NEW.profile_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instructor_sync_profile ON public.instructor;
CREATE TRIGGER trg_instructor_sync_profile
    AFTER UPDATE OF first_name, last_name, profile_photo ON public.instructor
    FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_instructor();


-- ================================================================
-- 5. STORAGE BUCKET FOR PROFILE PHOTOS
--    Files must be uploaded to: profile-photos/<auth.uid()>/<filename>
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-photos',
    'profile-photos',
    TRUE,
    2097152, -- 2 MB
    ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
CREATE POLICY "profile_photos_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_own_insert" ON storage.objects;
CREATE POLICY "profile_photos_own_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'profile-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "profile_photos_own_update" ON storage.objects;
CREATE POLICY "profile_photos_own_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'profile-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "profile_photos_own_delete" ON storage.objects;
CREATE POLICY "profile_photos_own_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'profile-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );


-- ================================================================
-- 6. PROFILE VIEWS — one-shot fetch for the profile page
--    security_invoker = true => respects the underlying RLS, so each
--    user only ever sees their own row through these views.
-- ================================================================

CREATE OR REPLACE VIEW public.v_my_student_profile AS
SELECT
    p.id               AS profile_id,
    p.role,
    p.created_at       AS account_created_at,

    s.student_id,
    s.first_name,
    s.last_name,
    s.gender,
    s.date_of_birth,
    s.phone,
    s.address,
    s.student_roll,
    s.batch_year,
    s.current_semester,
    s.cgpa,
    s.total_credits,
    s.profile_photo,
    s.emergency_contact_name,
    s.emergency_contact_phone,
    s.is_active,
    s.updated_at,

    prog.program_id,
    prog.program_name,
    prog.program_code,
    prog.degree_level,
    d.dept_id,
    d.dept_name,
    d.dept_code
FROM public.profiles p
JOIN public.student     s    ON s.profile_id  = p.id
JOIN public.program     prog ON prog.program_id = s.program_id
JOIN public.department  d    ON d.dept_id      = prog.dept_id;

ALTER VIEW public.v_my_student_profile SET (security_invoker = true);


CREATE OR REPLACE VIEW public.v_my_instructor_profile AS
SELECT
    p.id               AS profile_id,
    p.role,
    p.created_at       AS account_created_at,

    i.instructor_id,
    i.first_name,
    i.last_name,
    i.gender,
    i.date_of_birth,
    i.phone,
    i.office_location,
    i.employee_id,
    i.hire_date,
    i.designation,
    i.specialization,
    i.bio,
    i.profile_photo,
    i.is_active,
    i.updated_at,

    d.dept_id,
    d.dept_name,
    d.dept_code
FROM public.profiles p
JOIN public.instructor i ON i.profile_id = p.id
JOIN public.department d ON d.dept_id    = i.dept_id;

ALTER VIEW public.v_my_instructor_profile SET (security_invoker = true);


-- ================================================================
-- 7. GRANTS
-- ================================================================

GRANT SELECT ON public.v_my_student_profile    TO authenticated;
GRANT SELECT ON public.v_my_instructor_profile TO authenticated;
