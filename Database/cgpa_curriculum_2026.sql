-- ============================================================
-- CGPA — align with the DU CSE OBE curriculum (§18.4 – §18.10)
-- ============================================================
-- Before this migration the backend treated every `exam` row as if it were an
-- independent course, weighting each by `exam.credit_hours` (default 3.0 PER
-- EXAM). A 3-credit course with a quiz, a midterm and a final therefore
-- contributed 9 credits and 3 separate grades to the student's CGPA.
--
-- The curriculum instead grades a COURSE once, out of 100, assembled from
-- fixed-weight mark heads:
--
--   Theory  Class Participation 5 · Class Test (best 1 of 2) 10 ·
--           Group Assignment/Presentation 10 · Midterm 25 · Final 50
--   Lab     Class Participation 10 · Continuous Lab Performance 30 ·
--           Lab Reports 10 · Lab Viva-Voce 20 · Capstone/Demo 30
--
--   SGPA = Σ Ci·Gi / Σ Ci  over one semester
--   CGPA = Σ Ci·Gi / Σ Ci  over all semesters   (both to 2 decimals)
--
-- 'D' or higher earns credit; 'F' earns none but still counts in the CGPA
-- denominator. 'W' is excluded entirely; 'I' converts to 'F' if not cleared.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- PART A: course_type — selects which mark-head weight table applies
-- ------------------------------------------------------------
ALTER TABLE public.manual_course
    ADD COLUMN IF NOT EXISTS course_type VARCHAR(10) NOT NULL DEFAULT 'theory';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manual_course_course_type_chk'
    ) THEN
        ALTER TABLE public.manual_course
            ADD CONSTRAINT manual_course_course_type_chk
            CHECK (course_type IN ('theory', 'lab'));
    END IF;
END $$;

COMMENT ON COLUMN public.manual_course.course_type IS
    'theory | lab — selects THEORY_WEIGHTS vs LAB_WEIGHTS for course grading (curriculum §18.4).';

-- Best-effort backfill: courses whose name/code marks them as a lab.
UPDATE public.manual_course
   SET course_type = 'lab'
 WHERE course_type = 'theory'
   AND (course_name ILIKE '%lab%' OR course_name ILIKE '%laborator%'
        OR course_code ILIKE '%L' OR credit_hours < 2.0);

-- ------------------------------------------------------------
-- PART B: exam.mark_head — which curriculum mark head an exam feeds
-- ------------------------------------------------------------
ALTER TABLE public.exam
    ADD COLUMN IF NOT EXISTS mark_head VARCHAR(32);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exam_mark_head_chk'
    ) THEN
        ALTER TABLE public.exam
            ADD CONSTRAINT exam_mark_head_chk
            CHECK (mark_head IS NULL OR mark_head IN (
                'participation', 'class_test', 'assignment', 'midterm', 'final',
                'continuous', 'reports', 'viva', 'capstone'
            ));
    END IF;
END $$;

COMMENT ON COLUMN public.exam.mark_head IS
    'Curriculum mark head (§18.4). NULL = legacy/untagged; the backend falls back to exam_type.';

-- Backfill from the existing exam_type values.
UPDATE public.exam SET mark_head = CASE exam_type
        WHEN 'Midterm'      THEN 'midterm'
        WHEN 'Final'        THEN 'final'
        WHEN 'Quiz'         THEN 'class_test'
        WHEN 'Assignment'   THEN 'assignment'
        WHEN 'Presentation' THEN 'assignment'
        WHEN 'Lab'          THEN 'continuous'
        WHEN 'Viva'         THEN 'viva'
        ELSE NULL
    END
 WHERE mark_head IS NULL;

CREATE INDEX IF NOT EXISTS idx_exam_course_head
    ON public.exam(manual_course_id, mark_head);

-- ------------------------------------------------------------
-- PART C: course_result — one graded row per (student, course)
-- ------------------------------------------------------------
-- FDs: course_result_id → all; (student_id, manual_course_id) → all
-- (candidate key). course_pct → grade → grade_points is a curriculum lookup,
-- not a stored transitive dependency on a non-key attribute. ✓ BCNF.
CREATE TABLE IF NOT EXISTS public.course_result (
    course_result_id BIGSERIAL PRIMARY KEY,
    student_id       INT NOT NULL REFERENCES public.student(student_id)
                             ON DELETE CASCADE ON UPDATE CASCADE,
    manual_course_id INT NOT NULL REFERENCES public.manual_course(manual_course_id)
                             ON DELETE CASCADE ON UPDATE CASCADE,
    course_pct       NUMERIC(5,2) CHECK (course_pct IS NULL OR course_pct BETWEEN 0 AND 100),
    grade            VARCHAR(2) CHECK (grade IS NULL OR grade IN (
                         'A+','A','A-','B+','B','B-','C+','C','D','F','W','I')),
    grade_points     NUMERIC(3,2) CHECK (grade_points IS NULL OR grade_points BETWEEN 0 AND 4),
    credit_hours     NUMERIC(3,1) NOT NULL CHECK (credit_hours > 0),
    semester_number  SMALLINT CHECK (semester_number IS NULL OR semester_number BETWEEN 1 AND 12),
    is_complete      BOOLEAN NOT NULL DEFAULT FALSE,
    computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, manual_course_id)
);

COMMENT ON TABLE public.course_result IS
    'Per-course final grade (curriculum §18.8). is_complete = the terminal mark '
    'head (Final for theory, Capstone for lab) has been entered; only complete '
    'courses count toward SGPA/CGPA.';

CREATE INDEX IF NOT EXISTS idx_course_result_student
    ON public.course_result(student_id, semester_number);

-- ------------------------------------------------------------
-- PART D: RLS — students read their own results; service_role writes
-- ------------------------------------------------------------
ALTER TABLE public.course_result ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_result_select_own ON public.course_result;
CREATE POLICY course_result_select_own ON public.course_result
    FOR SELECT USING (
        student_id IN (
            SELECT s.student_id FROM public.student s WHERE s.profile_id = auth.uid()
        )
        OR manual_course_id IN (
            SELECT mc.manual_course_id
              FROM public.manual_course mc
              JOIN public.instructor i ON i.instructor_id = mc.instructor_id
             WHERE i.profile_id = auth.uid()
        )
    );

GRANT SELECT ON public.course_result TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.course_result_course_result_id_seq TO authenticated;

-- ------------------------------------------------------------
-- PART E: v_profile_email — batch email lookup for course rosters
-- ------------------------------------------------------------
-- Emails live only in auth.users, so the roster endpoint was issuing one
-- auth.admin.get_user_by_id() call PER STUDENT. This view lets the backend
-- (service_role) fetch them all in a single query.
CREATE OR REPLACE VIEW public.v_profile_email AS
    SELECT p.id, u.email
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id;

ALTER VIEW public.v_profile_email SET (security_invoker = on);

COMMENT ON VIEW public.v_profile_email IS
    'profile_id -> email. security_invoker keeps auth.users RLS in force, so '
    'only service_role can read it in practice.';

REVOKE ALL ON public.v_profile_email FROM anon, authenticated;

COMMIT;
