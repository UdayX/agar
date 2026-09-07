import { defineConfig } from 'vite';

// base is set for GitHub Pages project sites (https://<user>.github.io/agar/)
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/agar/',
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
