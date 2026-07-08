import { defineConfig } from 'vitest/config';

// Without this, Vitest's default include glob also picks up frontend/'s
// test files when run from repo root (they're a separate package with
// their own npm test script, meant to run independently).
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/frontend/**'],
  },
});
