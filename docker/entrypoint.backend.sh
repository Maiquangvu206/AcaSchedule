#!/bin/sh
set -e

# Apply migrations before serving traffic (idempotent, checksum-guarded).
node dist/database/migrate.js

# Seeding is idempotent and useful for the demo environment.
if [ "${SEED_ON_START:-true}" = "true" ]; then
  node dist/database/seed.js
fi

exec node dist/main.js
