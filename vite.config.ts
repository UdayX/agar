import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// base is set for GitHub Pages project sites (https://<user>.github.io/agar/)
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/agar/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        attributions: fileURLToPath(new URL('./attributions.html', import.meta.url)),
      },
    },
  },
});
