import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
  build: {
    rollupOptions: {
      output: {
        // pustaka pihak ketiga dipisah agar tetap tersimpan di cache browser saat kode aplikasi berubah
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'axios'] },
      },
    },
  },
});
