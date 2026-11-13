import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getFirebase, isFirebaseConfigured } from './firebase';

export interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  mode: 'firebase' | 'demo';
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

const DEMO_KEY = 'fodears:demo-user';
const DEMO_USER: AppUser = { uid: 'demo', name: 'Inversor Demo', email: 'demo@fodears.app', photoURL: null };

function readDemoUser(): AppUser | null {
  try {
    return localStorage.getItem(DEMO_KEY) ? DEMO_USER : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = isFirebaseConfigured ? 'firebase' : 'demo';
  const [user, setUser] = useState<AppUser | null>(() => (mode === 'demo' ? readDemoUser() : null));
  const [loading, setLoading] = useState(mode === 'firebase');

  useEffect(() => {
    if (mode !== 'firebase') return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { auth } = await getFirebase();
      const { onAuthStateChanged } = await import('firebase/auth');
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u ? { uid: u.uid, name: u.displayName ?? 'Inversor', email: u.email, photoURL: u.photoURL } : null);
        setLoading(false);
      });
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [mode]);

  const signIn = useCallback(async () => {
    if (mode === 'demo') {
      try {
        localStorage.setItem(DEMO_KEY, '1');
      } catch {
        /* sin storage: la sesión dura lo que la pestaña */
      }
      setUser(DEMO_USER);
      return;
    }
    const { auth } = await getFirebase();
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  }, [mode]);

  const signOut = useCallback(async () => {
    if (mode === 'demo') {
      try {
        localStorage.removeItem(DEMO_KEY);
      } catch {
        /* ignorar */
      }
      setUser(null);
      return;
    }
    const { auth } = await getFirebase();
    const { signOut: fbSignOut } = await import('firebase/auth');
    await fbSignOut(auth);
  }, [mode]);

  const value = useMemo(() => ({ user, loading, mode, signIn, signOut }) as AuthState, [user, loading, mode, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
