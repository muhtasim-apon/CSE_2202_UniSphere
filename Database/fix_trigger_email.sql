-- Fix: the broadcast_achievement_notification trigger references "email" from
-- the profiles table, but that column doesn't exist (email lives in auth.users).
-- The Python backend already handles notifications via _broadcast_achievement(),
-- so these DB triggers are redundant and cause double-notifications + 500 errors.
-- Drop them here; the backend handles everything.

DROP TRIGGER IF EXISTS trg_project_notify ON project;
DROP TRIGGER IF EXISTS trg_certificate_notify ON certificate;
DROP TRIGGER IF EXISTS trg_research_paper_notify ON research_paper;

DROP FUNCTION IF EXISTS broadcast_achievement_notification();
