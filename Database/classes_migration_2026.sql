-- ============================================================
-- STEP 1: Drop dependent views first
-- ============================================================
DROP VIEW IF EXISTS public.v_suspicious_logins;
DROP VIEW IF EXISTS public.v_pending_requests;

-- ============================================================
-- STEP 2: Drop hackathon tables (CASCADE handles child FK refs)
-- ============================================================
DROP TABLE IF EXISTS public.hackathon_skill  CASCADE;
DROP TABLE IF EXISTS public.hackathon_media  CASCADE;
DROP TABLE IF EXISTS public.hackathon        CASCADE;

-- ============================================================
-- STEP 3: Drop login_attempt
-- ============================================================
DROP TABLE IF EXISTS public.login_attempt CASCADE;

-- ============================================================
-- STEP 4: Drop functions that reference registration_request
-- (must drop before dropping the table)
-- ============================================================
DROP FUNCTION IF EXISTS public.fn_approve_request(integer, uuid, text, text);
DROP FUNCTION IF EXISTS public.fn_reject_request(integer, uuid, text);
DROP FUNCTION IF EXISTS public.fn_submit_signup_request(
    text, text, text, text, text, text, date, integer, smallint, integer, text, text);
DROP FUNCTION IF EXISTS public.fn_verify_email_token(text);

-- ============================================================
-- STEP 5: Drop registration_request table
-- ============================================================
DROP TABLE IF EXISTS public.registration_request CASCADE;

-- ============================================================
-- STEP 6: Add semester_number column to manual_course
-- 1=Y1S1, 2=Y1S2, 3=Y2S1, 4=Y2S2, 5=Y3S1, 6=Y3S2, 7=Y4S1, 8=Y4S2
-- ============================================================
ALTER TABLE public.manual_course
    ADD COLUMN IF NOT EXISTS semester_number SMALLINT
        CHECK (semester_number BETWEEN 1 AND 8);

COMMENT ON COLUMN public.manual_course.semester_number IS
    '1=Y1S1, 2=Y1S2, 3=Y2S1, 4=Y2S2, 5=Y3S1, 6=Y3S2, 7=Y4S1, 8=Y4S2';

-- ============================================================
-- STEP 7: Fix auto_assign_grade to match DU/CSEDU curriculum
-- Official scale: A+(4.00), A(3.75), A-(3.50), B+(3.25),
--   B(3.00), B-(2.75), C+(2.50), C(2.25), D(2.00), F(0.00)
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_assign_grade(
    p_marks NUMERIC,
    p_total NUMERIC
) RETURNS TABLE(grade VARCHAR, grade_points NUMERIC) AS $$
DECLARE
    pct NUMERIC;
BEGIN
    IF p_total IS NULL OR p_total <= 0 THEN
        RETURN QUERY SELECT 'F'::VARCHAR, 0.00::NUMERIC; RETURN;
    END IF;
    pct := (p_marks / p_total) * 100;
    IF    pct >= 80 THEN RETURN QUERY SELECT 'A+'::VARCHAR, 4.00::NUMERIC;
    ELSIF pct >= 75 THEN RETURN QUERY SELECT 'A'::VARCHAR,  3.75::NUMERIC;
    ELSIF pct >= 70 THEN RETURN QUERY SELECT 'A-'::VARCHAR, 3.50::NUMERIC;
    ELSIF pct >= 65 THEN RETURN QUERY SELECT 'B+'::VARCHAR, 3.25::NUMERIC;
    ELSIF pct >= 60 THEN RETURN QUERY SELECT 'B'::VARCHAR,  3.00::NUMERIC;
    ELSIF pct >= 55 THEN RETURN QUERY SELECT 'B-'::VARCHAR, 2.75::NUMERIC;
    ELSIF pct >= 50 THEN RETURN QUERY SELECT 'C+'::VARCHAR, 2.50::NUMERIC;
    ELSIF pct >= 45 THEN RETURN QUERY SELECT 'C'::VARCHAR,  2.25::NUMERIC;
    ELSIF pct >= 40 THEN RETURN QUERY SELECT 'D'::VARCHAR,  2.00::NUMERIC;
    ELSE                  RETURN QUERY SELECT 'F'::VARCHAR,  0.00::NUMERIC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 8: Fix student guard trigger so CGPA auto-updates
-- (remove cgpa and total_credits from the locked-field list)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_student_profile_restrictions()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;
    -- cgpa and total_credits are intentionally excluded — they are
    -- system-calculated and updated by the backend after mark entry.
    IF NEW.profile_id         IS DISTINCT FROM OLD.profile_id
       OR NEW.program_id      <> OLD.program_id
       OR NEW.student_roll    <> OLD.student_roll
       OR NEW.batch_year      <> OLD.batch_year
       OR NEW.current_semester <> OLD.current_semester
       OR NEW.is_active        <> OLD.is_active
    THEN
        RAISE EXCEPTION 'PROFILE_FIELD_LOCKED: cannot modify restricted student fields';
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 9: Update exam_mark grade CHECK to match DU scale
-- (drop old constraint, add new one without C- and D+)
-- ============================================================
ALTER TABLE public.exam_mark
    DROP CONSTRAINT IF EXISTS exam_mark_grade_check;

ALTER TABLE public.exam_mark
    ADD CONSTRAINT exam_mark_grade_check
    CHECK (grade IN ('A+','A','A-','B+','B','B-','C+','C','D','F'));
