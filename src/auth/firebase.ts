/**
 * Firebase se carga bajo demanda (import dinámico) para que el modo demo no descargue el SDK.
 * Si falta alguna variable VITE_FIREBASE_*, la app usa un login de demo y guarda en localStorage.
 */
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured =
  !!config.apiKey && !!config.authDomain && !!config.projectId && !!config.appId;

let cached: Promise<{ app: FirebaseApp; auth: Auth; db: Firestore }> | null = null;

export function getFirebase() {
  if (!isFirebaseConfigured) throw new Error('Firebase no está configurado');
  cached ??= (async () => {
    const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(config);
    return { app, auth: getAuth(app), db: getFirestore(app) };
  })();
  return cached;
}
