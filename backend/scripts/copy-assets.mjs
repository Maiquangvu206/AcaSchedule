import { cp } from 'node:fs/promises';

// tsc does not copy .sql files into dist — mirror the migrations folder.
await cp(
  new URL('../src/database/migrations', import.meta.url),
  new URL('../dist/database/migrations', import.meta.url),
  { recursive: true },
);

console.log('Copied database migrations to dist/');
