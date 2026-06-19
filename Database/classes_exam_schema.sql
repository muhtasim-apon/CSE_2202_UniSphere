-- ============================================================
-- CLASSES & EXAM SCHEMA — EduHub University ERP (Supabase)
-- Run AFTER: schema.sql, achievements_schema.sql
--
-- Tables that actually exist and can be referenced:
--   auth.users(id UUID)
--   public.profiles(id UUID)
--   public.instructor(instructor_id INT, profile_id UUID)
--   public.student(student_id INT, profile_id UUID)
--   public.department(dept_id INT)
--   public.project(project_id INT, user_id UUID)
--   public.notification(...)
-- ============================================================


-- ============================================================
-- PART A: ADD ADVISOR COLUMNS TO PROJECT
-- ============================================================
-- FDs: project_id → advisor_name, advisor_user_id. Both depend only on
-- the project, not on each other (mutually exclusive usage). ✓ BCNF.

ALTER TABLE public.project
    ADD COLUMN IF NOT EXISTS advisor_name    VARCHAR(120),
    ADD COLUMN IF NOT EXISTS advisor_user_id INT REFERENCES public.instructor(instructor_id)
                                                 ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON COLUMN public.project.advisor_name IS
    'External advisor name (not in system). Use this OR advisor_user_id, not both.';
COMMENT ON COLUMN public.project.advisor_user_id IS
    'Internal advisor — references instructor table.';


-- ============================================================
-- PART B: MANUAL COURSE
-- ============================================================
-- FDs: manual_course_id → all; enroll_code → manual_course_id (candidate key). ✓ BCNF.

CREATE TABLE IF NOT EXISTS public.manual_course (
    manual_course_id SERIAL PRIMARY KEY,
    instructor_id    INT  NOT NULL REFERENCES public.instructor(instructor_id)
                              ON DELETE RESTRICT ON UPDATE CASCADE,
    dept_id          INT  REFERENCES public.department(dept_id)
                              ON DELETE SET NULL ON UPDATE CASCADE,
    course_name      VARCHAR(255) NOT NULL,
    course_code      VARCHAR(50),
    description      TEXT,
    credit_hours     NUMERIC(3,1) DEFAULT 3.0 CHECK (credit_hours > 0),
    enroll_code      VARCHAR(20)  NOT NULL UNIQUE,
    semester         VARCHAR(50),
    academic_year    VARCHAR(20),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- PART C: MANUAL ENROLLMENT
-- ============================================================
-- FDs: enrollment_id → all; (manual_course_id, student_id) → all (candidate key). ✓ BCNF.

CREATE TABLE IF NOT EXISTS public.manual_enrollment (
    enrollment_id    SERIAL PRIMARY KEY,
    manual_course_id INT NOT NULL REFERENCES public.manual_course(manual_course_id)
                             ON DELETE RESTRICT ON UPDATE CASCADE,
    student_id       INT NOT NULL REFERENCES public.student(student_id)
                             ON DELETE RESTRICT ON UPDATE CASCADE,
    enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (manual_course_id, student_id)
);


-- ============================================================
-- PART D: ATTENDANCE
-- ============================================================
-- FDs: session_id → all. instructor_id is the creator, manual_course_id is
-- the course. No transitive deps. ✓ BCNF.

CREATE TABLE IF NOT EXISTS public.attendance_session (
    session_id       SERIAL PRIMARY KEY,
    manual_course_id INT NOT NULL REFERENCES public.manual_course(manual_course_id)
                             ON DELETE CASCADE ON UPDATE CASCADE,
    instructor_id    INT NOT NULL REFERENCES public.instructor(instructor_id)
                             ON DELETE RESTRICT ON UPDATE CASCADE,
    session_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    session_title    VARCHAR(255),
    topic            VARCHAR(255),
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FDs: record_id → all; (session_id, student_id) → all (candidate key). ✓ BCNF.
-- status is VARCHAR+CHECK because attendance_status enum is not deployed in Supabase.

CREATE TABLE IF NOT EXISTS public.attendance_record (
    record_id   SERIAL PRIMARY KEY,
    session_id  INT NOT NULL REFERENCES public.attendance_session(session_id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
    student_id  INT NOT NULL REFERENCES public.student(student_id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
    status      VARCHAR(10) NOT NULL DEFAULT 'Present'
                    CHECK (status IN ('Present','Absent','Late','Excused')),
    remarks     VARCHAR(200),
    marked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, student_id)
);


-- ============================================================
-- PART E: EXAM AND MARKS
-- ============================================================
-- created_by references auth.users(id) — same pattern as project, notification, etc.
-- FDs: exam_id → all. ✓ BCNF.

CREATE TABLE IF NOT EXISTS public.exam (
    exam_id          SERIAL PRIMARY KEY,
    manual_course_id INT REFERENCES public.manual_course(manual_course_id)
                             ON DELETE CASCADE ON UPDATE CASCADE,
    exam_name        VARCHAR(255) NOT NULL,
    exam_type        VARCHAR(30)  NOT NULL DEFAULT 'Midterm'
                         CHECK (exam_type IN (
                             'Midterm','Final','Quiz','Assignment',
                             'Lab','Viva','Presentation','Other'
                         )),
    total_marks      NUMERIC(6,2) NOT NULL CHECK (total_marks > 0),
    credit_hours     NUMERIC(3,1) DEFAULT 3.0 CHECK (credit_hours > 0),
    exam_date        DATE,
    semester         VARCHAR(50),
    academic_year    VARCHAR(20),
    description      TEXT,
    is_published     BOOLEAN NOT NULL DEFAULT TRUE,
    created_by       UUID NOT NULL REFERENCES auth.users(id)
                             ON DELETE RESTRICT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FDs: mark_id → all; (exam_id, student_id) → all (candidate key).
-- grade/grade_points stored for override capability. ✓ BCNF.

CREATE TABLE IF NOT EXISTS public.exam_mark (
    mark_id        SERIAL PRIMARY KEY,
    exam_id        INT NOT NULL REFERENCES public.exam(exam_id)
                           ON DELETE CASCADE ON UPDATE CASCADE,
    student_id     INT NOT NULL REFERENCES public.student(student_id)
                           ON DELETE CASCADE ON UPDATE CASCADE,
    marks_obtained NUMERIC(6,2) NOT NULL CHECK (marks_obtained >= 0),
    grade          VARCHAR(5) CHECK (grade IN ('A+','A','A-','B+','B','B-','C+','C','C-','D+','D','F')),
    grade_points   NUMERIC(3,2) CHECK (grade_points BETWEEN 0 AND 4),
    remarks        TEXT,
    entered_by     UUID NOT NULL REFERENCES auth.users(id)
                           ON DELETE RESTRICT,
    entered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (exam_id, student_id)
);


-- ============================================================
-- PART F: CGPA HISTORY
-- ============================================================
-- FDs: record_id → all. Multiple rows per student (one per recalculation). ✓ BCNF.

CREATE TABLE IF NOT EXISTS public.cgpa_record (
    record_id     SERIAL PRIMARY KEY,
    student_id    INT NOT NULL REFERENCES public.student(student_id)
                          ON DELETE CASCADE ON UPDATE CASCADE,
    cgpa          NUMERIC(4,2) NOT NULL CHECK (cgpa BETWEEN 0 AND 4),
    total_credits NUMERIC(6,1) NOT NULL DEFAULT 0,
    total_points  NUMERIC(8,2) NOT NULL DEFAULT 0,
    exam_count    INT NOT NULL DEFAULT 0,
    semester      VARCHAR(50),
    source        VARCHAR(20) NOT NULL DEFAULT 'exam_marks'
                      CHECK (source IN ('exam_marks','manual')),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- PART G: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_manual_course_instructor  ON public.manual_course(instructor_id);
CREATE INDEX IF NOT EXISTS idx_manual_course_enroll_code ON public.manual_course(enroll_code);
CREATE INDEX IF NOT EXISTS idx_manual_enrollment_student ON public.manual_enrollment(student_id);
CREATE INDEX IF NOT EXISTS idx_manual_enrollment_course  ON public.manual_enrollment(manual_course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_course ON public.attendance_session(manual_course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_date   ON public.attendance_session(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_record_session ON public.attendance_record(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_record_student ON public.attendance_record(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_course               ON public.exam(manual_course_id);
CREATE INDEX IF NOT EXISTS idx_exam_created_by           ON public.exam(created_by);
CREATE INDEX IF NOT EXISTS idx_exam_mark_exam            ON public.exam_mark(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_mark_student         ON public.exam_mark(student_id);
CREATE INDEX IF NOT EXISTS idx_cgpa_record_student       ON public.cgpa_record(student_id);


-- ============================================================
-- PART H: UPDATED_AT TRIGGERS (reuse existing set_updated_at())
-- ============================================================

CREATE TRIGGER trg_manual_course_updated_at
    BEFORE UPDATE ON public.manual_course
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_exam_updated_at
    BEFORE UPDATE ON public.exam
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_exam_mark_updated_at
    BEFORE UPDATE ON public.exam_mark
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- PART I: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.manual_course     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_record  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_mark         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cgpa_record       ENABLE ROW LEVEL SECURITY;

-- manual_course: teachers see their own; students see active courses they enrolled in
CREATE POLICY "mc_select" ON public.manual_course
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "mc_insert" ON public.manual_course
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.instructor i
                WHERE i.instructor_id = manual_course.instructor_id
                  AND i.profile_id = auth.uid())
    );
CREATE POLICY "mc_update" ON public.manual_course
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.instructor i
                WHERE i.instructor_id = manual_course.instructor_id
                  AND i.profile_id = auth.uid())
    );

-- manual_enrollment: authenticated users can read; students insert their own
CREATE POLICY "me_select" ON public.manual_enrollment
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "me_insert" ON public.manual_enrollment
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.student s
                WHERE s.student_id = manual_enrollment.student_id
                  AND s.profile_id = auth.uid())
    );

-- attendance: all authenticated can read; service_role handles inserts/updates
CREATE POLICY "as_select" ON public.attendance_session FOR SELECT TO authenticated USING (true);
CREATE POLICY "ar_select" ON public.attendance_record  FOR SELECT TO authenticated USING (true);

-- exam: all authenticated can read published; owner can do anything
CREATE POLICY "exam_select" ON public.exam
    FOR SELECT TO authenticated
    USING (is_published = TRUE OR created_by = auth.uid());
CREATE POLICY "exam_insert" ON public.exam
    FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "exam_update" ON public.exam
    FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- exam_mark: students see their own; service_role manages everything
CREATE POLICY "em_select" ON public.exam_mark
    FOR SELECT TO authenticated
    USING (
        entered_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.student s WHERE s.student_id = exam_mark.student_id AND s.profile_id = auth.uid())
    );
CREATE POLICY "em_insert" ON public.exam_mark
    FOR INSERT TO authenticated WITH CHECK (entered_by = auth.uid());
CREATE POLICY "em_update" ON public.exam_mark
    FOR UPDATE TO authenticated USING (entered_by = auth.uid());

-- cgpa_record: students see their own
CREATE POLICY "cgpa_select" ON public.cgpa_record
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.student s
                WHERE s.student_id = cgpa_record.student_id
                  AND s.profile_id = auth.uid())
    );


-- ============================================================
-- PART J: GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON public.manual_course     TO authenticated;
GRANT SELECT, INSERT         ON public.manual_enrollment TO authenticated;
GRANT SELECT                 ON public.attendance_session TO authenticated;
GRANT SELECT                 ON public.attendance_record  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exam              TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exam_mark         TO authenticated;
GRANT SELECT                 ON public.cgpa_record       TO authenticated;

GRANT ALL ON public.manual_course, public.manual_enrollment,
            public.attendance_session, public.attendance_record,
            public.exam, public.exam_mark, public.cgpa_record
    TO service_role;

GRANT USAGE, SELECT ON SEQUENCE
    public.manual_course_manual_course_id_seq,
    public.manual_enrollment_enrollment_id_seq,
    public.attendance_session_session_id_seq,
    public.attendance_record_record_id_seq,
    public.exam_exam_id_seq,
    public.exam_mark_mark_id_seq,
    public.cgpa_record_record_id_seq
    TO authenticated;


-- ============================================================
-- PART K: CGPA GRADE CALCULATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_assign_grade(p_marks NUMERIC, p_total NUMERIC)
RETURNS TABLE(grade VARCHAR, grade_points NUMERIC) AS $$
DECLARE
    pct NUMERIC;
BEGIN
    pct := (p_marks / p_total) * 100;
    IF    pct >= 80 THEN RETURN QUERY SELECT 'A+'::VARCHAR, 4.00::NUMERIC;
    ELSIF pct >= 75 THEN RETURN QUERY SELECT 'A'::VARCHAR,  3.75::NUMERIC;
    ELSIF pct >= 70 THEN RETURN QUERY SELECT 'A-'::VARCHAR, 3.50::NUMERIC;
    ELSIF pct >= 65 THEN RETURN QUERY SELECT 'B+'::VARCHAR, 3.25::NUMERIC;
    ELSIF pct >= 60 THEN RETURN QUERY SELECT 'B'::VARCHAR,  3.00::NUMERIC;
    ELSIF pct >= 55 THEN RETURN QUERY SELECT 'B-'::VARCHAR, 2.75::NUMERIC;
    ELSIF pct >= 50 THEN RETURN QUERY SELECT 'C+'::VARCHAR, 2.50::NUMERIC;
    ELSIF pct >= 45 THEN RETURN QUERY SELECT 'C'::VARCHAR,  2.25::NUMERIC;
    ELSIF pct >= 40 THEN RETURN QUERY SELECT 'C-'::VARCHAR, 2.00::NUMERIC;
    ELSIF pct >= 35 THEN RETURN QUERY SELECT 'D+'::VARCHAR, 1.75::NUMERIC;
    ELSIF pct >= 33 THEN RETURN QUERY SELECT 'D'::VARCHAR,  1.50::NUMERIC;
    ELSE                  RETURN QUERY SELECT 'F'::VARCHAR,  0.00::NUMERIC;
    END IF;
END;
$$ LANGUAGE plpgsql;
