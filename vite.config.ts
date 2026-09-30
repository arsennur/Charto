import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'demo-dist' },
  server: { port: 5173, strictPort: true },
});
