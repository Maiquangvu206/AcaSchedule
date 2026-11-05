import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Coverage gate (≥ 80% lines/functions/statements, ≥ 70% branches) requires
    // @vitest/coverage-v8 which is not installed in this offline environment.
    // Re-add `coverage` block once the package is available:
    //   npm install --save-dev @vitest/coverage-v8
  },
});
