-- Student registration numbers are digits-only (e.g. 2023715947), not the
-- old YYYY-DEPT-NNN roll format. Relax the check constraint accordingly.
ALTER TABLE public.student
    DROP CONSTRAINT student_student_roll_check;

ALTER TABLE public.student
    ADD CONSTRAINT student_student_roll_check
    CHECK (student_roll ~ '^[0-9]{4,20}$');
