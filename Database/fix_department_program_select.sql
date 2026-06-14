-- department and program are reference data (used by v_my_student_profile /
-- v_my_instructor_profile joins and the onboarding find-or-create flow).
-- RLS is enabled on them with no SELECT policy, so the joins in those views
-- silently drop the row for every non-service-role caller. Allow any
-- authenticated user to read them.
CREATE POLICY "department_auth_select"
    ON public.department FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "program_auth_select"
    ON public.program FOR SELECT TO authenticated
    USING (true);
