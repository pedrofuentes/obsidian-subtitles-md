import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // `obsidian` ships types only; map it to a runtime stub for unit tests of
      // Obsidian-coupled modules. Production builds keep `obsidian` external.
      obsidian: `${import.meta.dirname}/tests/mocks/obsidian.mjs`,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: [
        'src/model/**',
        'src/parser/**',
        'src/transform/**',
        'src/serialize/**',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
