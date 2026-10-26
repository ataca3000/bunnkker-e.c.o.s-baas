import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx,js,jsx}'],
    exclude: ['node_modules', 'tests/e2e/**', '**/*.spec.ts', '.next/**'],
    globals: true,
  },
});
