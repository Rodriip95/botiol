import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // "localhost" (no 127.0.0.1): es el único host local que Firebase Auth autoriza por defecto.
  server: { host: 'localhost', port: 5174 },
  preview: { host: 'localhost', port: 4174 },
  // Firestore (~580 kB) se carga bajo demanda solo si Firebase está configurado.
  build: { chunkSizeWarningLimit: 700 },
});
