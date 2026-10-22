#!/usr/bin/env bash
set -euo pipefail
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
for pass in 1 2; do
  for file in supabase/migrations/*.sql; do psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"; done
done
for file in supabase/tests/*.sql; do
  if [[ "$file" != *bootstrap.sql ]]; then psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"; fi
done
