#!/usr/bin/env bash
# Applies all migrations to a fresh database on a plain Postgres server (with a stand-in for
# Supabase's auth schema) and runs the row-level security tests.
#
#   PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
DB="beatmap_test_$$"
psql -q -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT

run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

# Roles are cluster-wide, so tolerate them already existing from an earlier run.
run -c "do \$\$ begin create role anon nologin; exception when duplicate_object then null; end \$\$;
        do \$\$ begin create role authenticated nologin; exception when duplicate_object then null; end \$\$;"
grep -v '^create role' supabase/tests/auth_stub.sql | run
for migration in supabase/migrations/*.sql; do
  run -f "$migration"
done
run -f supabase/tests/rls.sql
