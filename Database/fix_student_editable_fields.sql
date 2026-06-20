-- ============================================================
-- Allow students to edit their own academic profile fields:
-- student_roll, batch_year, current_semester, program_id
--
-- Only profile_id (auth identity) and is_active (admin only)
-- remain locked. Everything else is self-editable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_student_profile_restrictions()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Service role (backend) bypasses all restrictions
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Only lock the identity link and admin-controlled status.
    -- student_roll, batch_year, current_semester, program_id
    -- are now self-editable by the student.
    -- cgpa and total_credits are auto-calculated by the backend.
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.is_active <> OLD.is_active
    THEN
        RAISE EXCEPTION 'PROFILE_FIELD_LOCKED: cannot modify restricted student fields';
    END IF;

    RETURN NEW;
END;
$$;
