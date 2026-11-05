# SQL migrations

Add numbered migrations here: `001_init.sql`, `002_...sql`.

Rules:

- Never edit an applied migration — the runner stores a checksum and rejects changes.
- One logical change per file; the runner wraps each file in a transaction.
- Run with `npm run migrate` (dev) or `node dist/database/migrate.js` (compiled).
- `.sql` files are copied to `dist/` by `scripts/copy-assets.mjs` during `npm run build`.
