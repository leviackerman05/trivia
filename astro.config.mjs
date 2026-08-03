// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // PRD §2/§3/§13: static MPA. No SSR, no SPA shell.
  output: 'static',
  site: 'https://partybrain.com',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
