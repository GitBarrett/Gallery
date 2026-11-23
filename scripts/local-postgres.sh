#!/usr/bin/env bash
# Local PostgreSQL 18 in WSL Ubuntu (T-04e): ls_dev for `pnpm dev`, ls_test for the integration tests.
# Run once, as root: wsl -d Ubuntu -- sudo bash scripts/local-postgres.sh
# Reachable from Windows on localhost:5432 (WSL forwards localhost). Re-running it changes nothing.
set -euo pipefail

if ! command -v /usr/lib/postgresql/18/bin/postgres >/dev/null; then
  apt-get update
  apt-get install -y curl ca-certificates postgresql-common
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y # PostgreSQL's own repository: 18 has uuidv7()
  apt-get install -y postgresql-18
fi
systemctl enable --now postgresql

# Local-only role, listening on localhost only: its password is not a secret
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'CREATE ROLE ls LOGIN SUPERUSER PASSWORD ''ls-local-only'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ls')\gexec
SELECT 'CREATE DATABASE ls_dev OWNER ls' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ls_dev')\gexec
SELECT 'CREATE DATABASE ls_test OWNER ls' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ls_test')\gexec
SQL

echo "PostgreSQL ready: postgres://ls:ls-local-only@localhost:5432/ls_dev (and ls_test)"
