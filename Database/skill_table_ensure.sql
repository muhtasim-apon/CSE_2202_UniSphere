-- Run this in Supabase SQL Editor to ensure the skill table exists.
-- Safe to run multiple times (idempotent).
-- Junction tables (project_skill, certificate_skill, etc.) are in achievements_schema.sql.

CREATE TABLE IF NOT EXISTS skill (
    skill_id    SERIAL PRIMARY KEY,
    skill_name  VARCHAR(100) NOT NULL UNIQUE,
    category    VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE skill ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_select" ON skill;
CREATE POLICY "skill_select" ON skill FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "skill_insert" ON skill;
CREATE POLICY "skill_insert" ON skill FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON skill TO authenticated;
GRANT ALL ON skill TO service_role;
GRANT USAGE, SELECT ON SEQUENCE skill_skill_id_seq TO authenticated, service_role;
