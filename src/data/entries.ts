/**
 * Consultas guardadas del usuario.
 * - Firebase: Firestore en users/{uid}/entries (ver firestore.rules).
 * - Demo: localStorage, misma interfaz.
 */
import type { NewEntry, SavedEntry } from '../lib/types';
import { getFirebase, isFirebaseConfigured } from '../auth/firebase';
import { CATALOG_BY_SYMBOL } from './catalog';

export interface EntriesRepo {
  subscribe(uid: string, cb: (entries: SavedEntry[]) => void, onError?: (e: Error) => void): () => void;
  add(uid: string, entry: NewEntry): Promise<void>;
  update(uid: string, id: string, patch: Partial<Pick<SavedEntry, 'inPortfolio'>>): Promise<void>;
  remove(uid: string, id: string): Promise<void>;
}

/* ---------- Demo (localStorage) ---------- */

const key = (uid: string) => `fodears:entries:${uid}`;
const listeners = new Map<string, Set<(e: SavedEntry[]) => void>>();

function read(uid: string): SavedEntry[] {
  try {
    const raw = localStorage.getItem(key(uid));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as SavedEntry[]) : seedDemo();
  } catch {
    return [];
  }
}

function write(uid: string, entries: SavedEntry[]) {
  try {
    localStorage.setItem(key(uid), JSON.stringify(entries));
  } catch {
    /* storage lleno o bloqueado: se mantiene en memoria hasta recargar */
  }
  listeners.get(uid)?.forEach((cb) => cb(entries));
}

/** Portfolio de ejemplo para que el modo demo no arranque vacío. */
function seedDemo(): SavedEntry[] {
  const now = Date.now();
  const mk = (i: number, symbol: string, quantity: number, invested: number, date: string, inPortfolio = true): SavedEntry => {
    // Foto "al guardar": precio de referencia del catálogo, un poco distinto al de hoy.
    const price = Math.round((CATALOG_BY_SYMBOL.get(symbol)?.seed[0] ?? invested / quantity) * (1 - 0.012 * i));
    const pnl = price * quantity - invested;
    return {
      id: `seed-${i}`,
      symbol,
      quantity,
      invested,
      date,
      inPortfolio,
      createdAt: now - i * 86_400_000,
      snapshot: { price, pnl, pnlPct: (pnl / invested) * 100 },
    };
  };
  return [
    mk(1, 'AAPL', 40, 820_000, '2025-06-12'),
    mk(2, 'MELI', 60, 1_050_000, '2025-09-03'),
    mk(3, 'NVDA', 150, 1_380_000, '2025-11-20'),
    mk(4, 'SPY', 50, 870_000, '2025-03-14'),
    mk(5, 'KO', 20, 610_000, '2026-02-10'),
    mk(6, 'VIST', 25, 820_000, '2026-04-22'),
    mk(7, 'TSLA', 10, 455_000, '2026-07-01', false),
  ];
}

const localRepo: EntriesRepo = {
  subscribe(uid, cb) {
    const set = listeners.get(uid) ?? new Set();
    set.add(cb);
    listeners.set(uid, set);
    cb(read(uid));
    return () => set.delete(cb);
  },
  async add(uid, entry) {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    write(uid, [{ ...entry, id, createdAt: Date.now() }, ...read(uid)]);
  },
  async update(uid, id, patch) {
    write(uid, read(uid).map((e) => (e.id === id ? { ...e, ...patch } : e)));
  },
  async remove(uid, id) {
    write(uid, read(uid).filter((e) => e.id !== id));
  },
};

/* ---------- Firestore ---------- */

const firestoreRepo: EntriesRepo = {
  subscribe(uid, cb, onError) {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { db } = await getFirebase();
      const { collection, onSnapshot, orderBy, query } = await import('firebase/firestore');
      if (cancelled) return;
      const q = query(collection(db, 'users', uid, 'entries'), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<SavedEntry, 'id'>), id: d.id }))),
        (err) => onError?.(err),
      );
    })().catch((e: unknown) => onError?.(e instanceof Error ? e : new Error(String(e))));
    return () => {
      cancelled = true;
      unsub?.();
    };
  },
  async add(uid, entry) {
    const { db } = await getFirebase();
    const { addDoc, collection } = await import('firebase/firestore');
    await addDoc(collection(db, 'users', uid, 'entries'), { ...entry, createdAt: Date.now() });
  },
  async update(uid, id, patch) {
    const { db } = await getFirebase();
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'users', uid, 'entries', id), patch);
  },
  async remove(uid, id) {
    const { db } = await getFirebase();
    const { deleteDoc, doc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', uid, 'entries', id));
  },
};

export const entriesRepo: EntriesRepo = isFirebaseConfigured ? firestoreRepo : localRepo;
