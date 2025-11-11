import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './src/__tests__/setup.ts',
    setupFiles: './src/__tests__/testSetup.ts',
    fileParallelism: false, // Run test files sequentially to avoid database conflicts
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
