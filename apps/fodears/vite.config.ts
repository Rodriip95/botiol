import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5174 },
  preview: { host: '127.0.0.1', port: 4174 },
  // Firestore (~580 kB) se carga bajo demanda solo si Firebase está configurado.
  build: { chunkSizeWarningLimit: 700 },
});
