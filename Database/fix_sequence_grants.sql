-- Run this in Supabase SQL Editor to fix "permission denied for sequence" errors.
-- The achievements_schema.sql only granted sequences to 'authenticated',
-- but the Python backend uses service_role which also needs USAGE/SELECT.

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
