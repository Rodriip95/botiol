import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CedearQuote, MarketSnapshot } from '../lib/types';
import { useAuth } from '../auth/AuthContext';
import { CedearPicker } from './CedearPicker';
import { GoogleMark, Icon, type IconName } from './Icon';

export type Route = 'calc' | 'mercado' | 'portfolio' | 'historial';

const NAV: { id: Route; label: string; icon: IconName }[] = [
  { id: 'calc', label: 'Calculadora', icon: 'calc' },
  { id: 'mercado', label: 'Mercado', icon: 'market' },
  { id: 'portfolio', label: 'Portfolio', icon: 'pie' },
  { id: 'historial', label: 'Historial', icon: 'history' },
];

export function Logo() {
  return (
    <span className="logo" aria-label="FODEARS">
      <span className="logo__mark">
        <Icon name="bolt" size={18} stroke={2.4} />
      </span>
    </span>
  );
}

function UserMenu({
  name,
  email,
  photoURL,
  demo,
  onSignOut,
}: {
  name: string;
  email: string | null;
  photoURL: string | null;
  demo: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="user-menu" ref={ref}>
      <button className="avatar" aria-label={`Cuenta de ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {photoURL ? <img src={photoURL} alt="" referrerPolicy="no-referrer" /> : name.slice(0, 1)}
      </button>
      {open && (
        <div className="user-menu__pop" role="menu">
          <div className="user-menu__who">
            <strong>{name}</strong>
            {email && <span>{email}</span>}
            {demo && <span className="tag">Modo demo</span>}
          </div>
          <button role="menuitem" className="user-menu__item" onClick={onSignOut}>
            <Icon name="logout" size={16} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({
  route,
  onRoute,
  quotes,
  snapshot,
  onQuickPick,
  children,
}: {
  route: Route;
  onRoute: (r: Route) => void;
  quotes: CedearQuote[];
  snapshot: MarketSnapshot | null;
  onQuickPick: (symbol: string) => void;
  children: ReactNode;
}) {
  const { user, signIn, signOut, mode, loading } = useAuth();
  return (
    <div className="app">
      <div className="frame">
        <aside className="rail" aria-label="Navegación">
          <Logo />
          <nav className="rail__nav">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={`rail__btn${route === n.id ? ' is-active' : ''}`}
                aria-current={route === n.id ? 'page' : undefined}
                onClick={() => onRoute(n.id)}
              >
                <Icon name={n.icon} />
                <span className="rail__label">{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="rail__foot">
            {user && (
              <button className="rail__btn" onClick={() => void signOut()}>
                <Icon name="logout" />
                <span className="rail__label">Salir</span>
              </button>
            )}
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="brand">
              <span className="brand__name">
                FO<span>DEARS</span>
              </span>
            </div>
            <CedearPicker
              variant="top"
              quotes={quotes}
              value=""
              onChange={onQuickPick}
              placeholder="Buscar CEDEAR…"
            />
            <div className="topbar__right">
              {snapshot && (
                <span className={`source source--${snapshot.source}`} title={`Actualizado ${snapshot.updatedAt.toLocaleTimeString('es-AR')}`}>
                  <span className="source__dot" />
                  {snapshot.source === 'mock' ? 'Datos de ejemplo' : 'data912 · demorado'}
                </span>
              )}
              {loading ? (
                <span className="avatar avatar--loading" aria-hidden="true" />
              ) : user ? (
                <UserMenu key={route} name={user.name} email={user.email} photoURL={user.photoURL} demo={mode === 'demo'} onSignOut={() => void signOut()} />
              ) : (
                <button className="btn btn--google" onClick={() => void signIn()}>
                  <GoogleMark size={16} />
                  <span>Ingresar</span>
                </button>
              )}
            </div>
          </header>
          <main className="content">{children}</main>
          <footer className="foot">
            <span>FODEARS · portFOlio de ceDEARS</span>
            <span>
              Datos con demora, solo informativos. No es asesoramiento financiero. No incluye comisiones ni impuestos.
            </span>
          </footer>
        </div>
      </div>
      <nav className="tabbar" aria-label="Navegación">
        {NAV.map((n) => (
          <button key={n.id} className={route === n.id ? 'is-active' : undefined} onClick={() => onRoute(n.id)}>
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
