#!/usr/bin/env bash
# =====================================================================
# UniSphere / EduHub — run_seed.sh
# =====================================================================
# 1) Provisions missing auth.users via the Supabase Admin API.
# 2) Emits a JSON map of resolved IDs.
# 3) Runs Database/seed.sql against the target Postgres database.
#
# Required environment:
#   SUPABASE_URL             e.g. https://xxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY   service_role JWT
#   SUPABASE_DB_URL          postgresql://postgres:...@db.xxx.supabase.co:5432/postgres
#
# Optional:
#   SEED_IDS_OUT             default /tmp/seed_ids.json
# =====================================================================

set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" || -z "${SUPABASE_DB_URL:-}" ]]; then
    echo "ERROR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL must be set." >&2
    echo "       See: tools/seed.py docstring." >&2
    exit 2
fi

SEED_IDS_OUT="${SEED_IDS_OUT:-/tmp/seed_ids.json}"
SEED_SQL="${SEED_SQL:-$(dirname "$0")/../Database/seed.sql}"

if [[ ! -f "$SEED_SQL" ]]; then
    echo "ERROR: seed.sql not found at $SEED_SQL" >&2
    exit 2
fi

echo "→ Step 1/2: Provisioning auth.users via Supabase Admin API…"
python3 "$(dirname "$0")/seed.py" --out "$SEED_IDS_OUT"

if [[ ! -s "$SEED_IDS_OUT" ]]; then
    echo "ERROR: seed.py produced an empty file at $SEED_IDS_OUT" >&2
    exit 2
fi

echo ""
echo "→ Step 2/2: Running Database/seed.sql against $SUPABASE_DB_URL …"
psql "$SUPABASE_DB_URL" \
    -v ON_ERROR_STOP=1 \
    -v seed_ids_json="$(cat "$SEED_IDS_OUT")" \
    -f "$SEED_SQL"

echo ""
echo "✓ Seed complete. Verify with:"
echo "    psql \"$SUPABASE_DB_URL\" -c \"SELECT COUNT(*) FROM public.student;\""
echo "    psql \"$SUPABASE_DB_URL\" -c \"SELECT COUNT(*) FROM public.instructor;\""
echo "    psql \"$SUPABASE_DB_URL\" -c \"SELECT COUNT(*) FROM public.manual_course;\""
