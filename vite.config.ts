import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.PAGES_BASE ?? '/agar/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        learn: fileURLToPath(new URL('./learn.html', import.meta.url)),
        attributions: fileURLToPath(new URL('./attributions.html', import.meta.url)),
      },
    },
  },
});
