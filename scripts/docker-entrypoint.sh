#!/bin/sh
set -eu

mkdir -p /data
mkdir -p "${PGLITE_DATA_DIR:-/data/pglite}"

SECRET_FILE=/data/better-auth-secret

# Prefer env; else reuse volume-persisted secret; else generate + write (0600).
if [ -n "${BETTER_AUTH_SECRET:-}" ]; then
  :
elif [ -f "$SECRET_FILE" ] && [ -s "$SECRET_FILE" ]; then
  BETTER_AUTH_SECRET="$(cat "$SECRET_FILE")"
  export BETTER_AUTH_SECRET
  echo "BETTER_AUTH_SECRET loaded from $SECRET_FILE"
else
  BETTER_AUTH_SECRET="$(openssl rand -hex 32 2>/dev/null || bun -e 'process.stdout.write(crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+b.toString(16).padStart(2,"0"),""))')"
  export BETTER_AUTH_SECRET
  umask 077
  printf '%s\n' "$BETTER_AUTH_SECRET" >"$SECRET_FILE"
  chmod 0600 "$SECRET_FILE"
  echo "BETTER_AUTH_SECRET was unset; generated and saved to $SECRET_FILE"
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "WARN: CRON_SECRET unset — /api/league/tick is public (in-process tick still runs)"
fi

# Apply SQL migrations when a hosted Postgres is configured (no-op on PGLite).
bun scripts/migrate.mjs

if [ "${OPENFF_DEV:-0}" = "1" ]; then
  exec bun run dev
fi
exec bun .output/server/index.mjs
