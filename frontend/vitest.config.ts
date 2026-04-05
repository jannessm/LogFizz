import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  define: {
    // Disable hCaptcha in tests so form submission is not blocked
    'import.meta.env.VITE_HCAPTCHA_SITE_KEY': JSON.stringify(''),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@clock/shared': path.resolve(__dirname, '../lib/utils'),
    },
    conditions: ['browser'],
  },
});
