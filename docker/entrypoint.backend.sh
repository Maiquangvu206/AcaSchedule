#!/bin/sh
set -e

# Apply migrations before serving traffic (idempotent, checksum-guarded).
node dist/database/migrate.js

# Seeding is opt-in. Production must not recreate demo data on restart.
if [ "${SEED_ON_START:-false}" = "true" ]; then
  node dist/database/seed.js
fi

exec node dist/main.js
