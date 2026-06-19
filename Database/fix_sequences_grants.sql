-- Fix: grant sequence usage to service_role (and authenticated).
-- Run this in the Supabase SQL Editor once.
-- Background: INSERT with a SERIAL column requires USAGE + SELECT on the
-- backing sequence. GRANT ALL ON TABLE does NOT cascade to sequences.
-- service_role is the PostgreSQL role used by the FastAPI backend.

GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public
    TO authenticated, service_role;
