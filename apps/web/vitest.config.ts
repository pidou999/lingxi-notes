import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    environment: 'node',
  },
});
