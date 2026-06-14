-- ================================================================
-- FIX — "infinite recursion detected in policy for relation profiles"
--
-- authentication.sql's admin/role-check policies re-query
-- public.profiles from within a policy ON public.profiles (and from
-- policies on student/instructor/registration_request/login_attempt
-- that also touch profiles), which recurses into the same policies.
--
-- Fix: read the caller's own profile row through a SECURITY DEFINER
-- helper function. Defined by the table owner (which has BYPASSRLS
-- in Supabase), so it reads public.profiles without re-triggering
-- these RLS policies, breaking the recursion.
--
-- Safe to re-run.
-- ================================================================

CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_profile() TO authenticated, anon;


-- profiles
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
CREATE POLICY "profiles_admin_select"
    ON public.profiles FOR SELECT TO authenticated
    USING ((public.current_profile()).role = 'admin');

DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
CREATE POLICY "profiles_own_update"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        role          = (public.current_profile()).role
        AND is_active = (public.current_profile()).is_active
        AND student_id    IS NOT DISTINCT FROM (public.current_profile()).student_id
        AND instructor_id IS NOT DISTINCT FROM (public.current_profile()).instructor_id
    );

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
    ON public.profiles FOR UPDATE TO authenticated
    USING ((public.current_profile()).role = 'admin');


-- student
DROP POLICY IF EXISTS "student_teacher_admin_select" ON public.student;
CREATE POLICY "student_teacher_admin_select"
    ON public.student FOR SELECT TO authenticated
    USING (
        (public.current_profile()).role IN ('teacher','admin')
    );


-- instructor
DROP POLICY IF EXISTS "instructor_all_auth_select" ON public.instructor;
CREATE POLICY "instructor_all_auth_select"
    ON public.instructor FOR SELECT TO authenticated
    USING (
        (public.current_profile()).role IN ('student','teacher','admin')
    );


-- registration_request
DROP POLICY IF EXISTS "rr_admin_select" ON public.registration_request;
CREATE POLICY "rr_admin_select"
    ON public.registration_request FOR SELECT TO authenticated
    USING ((public.current_profile()).role = 'admin');

DROP POLICY IF EXISTS "rr_admin_update" ON public.registration_request;
CREATE POLICY "rr_admin_update"
    ON public.registration_request FOR UPDATE TO authenticated
    USING ((public.current_profile()).role = 'admin');


-- login_attempt
DROP POLICY IF EXISTS "la_admin_select" ON public.login_attempt;
CREATE POLICY "la_admin_select"
    ON public.login_attempt FOR SELECT TO authenticated
    USING ((public.current_profile()).role = 'admin');
