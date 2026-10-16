import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base =
  process.env.GITHUB_ACTIONS === 'true' &&
  repository &&
  !repository.endsWith('.github.io')
    ? `/${repository}`
    : '/';

export default defineConfig({
  base,
  integrations: [react()],
  vite: {
    build: { chunkSizeWarningLimit: 1200 }, // three.js é grande por natureza
  },
});
