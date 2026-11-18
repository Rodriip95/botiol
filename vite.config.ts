import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const PROVIDERS = ['mock', 'data912'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const provider = env.VITE_DATA_PROVIDER;
  if (provider && !PROVIDERS.includes(provider)) {
    throw new Error(`VITE_DATA_PROVIDER="${provider}" no es válido. Opciones: ${PROVIDERS.join(', ')}.`);
  }
  // El deploy de producción en Vercel tiene que mostrar precios reales: si alguien deja "mock", el build falla.
  if (process.env.VERCEL_ENV === 'production' && provider && provider !== 'data912') {
    throw new Error(`En producción VITE_DATA_PROVIDER tiene que ser "data912" (está en "${provider}"). Corregilo en Vercel → Settings → Environment Variables.`);
  }

  return {
    plugins: [react()],
    // "localhost" (no 127.0.0.1): es el único host local que Firebase Auth autoriza por defecto.
    server: { host: 'localhost', port: 5174 },
    preview: { host: 'localhost', port: 4174 },
    // Firestore (~580 kB) se carga bajo demanda solo si Firebase está configurado.
    build: { chunkSizeWarningLimit: 700 },
  };
});
