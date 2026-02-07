import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/integration/**/*.test.js'],
    exclude: ['tests/**/*.spec.js', 'tests/**/*.spec.mjs'],
    globals: false,
    environment: 'node',
  },
});
