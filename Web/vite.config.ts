// PROTÓTIPO (ticket 19). Dev na 3006; /api vai para a API real do stack docker em :5000.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3006,
    strictPort: true,
    proxy: { '/api': 'http://localhost:5000' },
  },
});
