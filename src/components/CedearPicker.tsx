import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CedearQuote } from '../lib/types';
import { SECTOR_COLOR } from '../data/catalog';
import { money, signedPct, tone } from '../lib/format';
import { Icon } from './Icon';

/** Normaliza para buscar sin tildes ni mayúsculas. */
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function searchQuotes(quotes: CedearQuote[], q: string, limit = 8): CedearQuote[] {
  const n = norm(q.trim());
  if (!n) return [...quotes].sort((a, b) => b.volume * b.last - a.volume * a.last).slice(0, limit);
  const scored: [number, CedearQuote][] = [];
  for (const x of quotes) {
    const sym = x.symbol.toLowerCase();
    const name = norm(x.name);
    let score = -1;
    if (sym === n) score = 100;
    else if (sym.startsWith(n)) score = 80 - sym.length;
    else if (name.startsWith(n)) score = 60;
    else if (name.includes(n)) score = 40;
    else if (sym.includes(n)) score = 30;
    else if (norm(x.sector).startsWith(n)) score = 10;
    if (score >= 0) scored.push([score, x]);
  }
  return scored.sort((a, b) => b[0] - a[0] || b[1].volume - a[1].volume).slice(0, limit).map(([, x]) => x);
}

export function CedearPicker({
  quotes,
  value,
  onChange,
  invalid,
  describedBy,
  placeholder = 'Buscá por ticker o empresa (ej. AAPL, Mercado)',
  autoFocus,
  variant = 'field',
  inputId,
}: {
  inputId?: string;
  quotes: CedearQuote[];
  value: string;
  onChange: (symbol: string) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  autoFocus?: boolean;
  variant?: 'field' | 'top';
}) {
  const listId = useId();
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Al enfocar se muestran los más operados; al tipear, se filtra por lo escrito.
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchQuotes(quotes, query), [quotes, query]);
  const selected = quotes.find((q) => q.symbol === value);

  const pick = (q: CedearQuote) => {
    onChange(q.symbol);
    setText(q.symbol);
    setOpen(false);
  };

  return (
    <div className={`picker picker--${variant}`} ref={wrap}>
      <div className="picker__input">
        <Icon name="search" size={16} />
        <input
          id={inputId}
          aria-label={variant === 'top' ? placeholder : undefined}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].symbol}` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          onFocus={(e) => {
            setQuery('');
            setActive(0);
            setOpen(true);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setText(e.target.value);
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (variant === 'field') onChange(e.target.value.trim().toUpperCase());
          }}
          // Los ítems usan preventDefault en mousedown, así que el blur solo llega al salir con Tab o tocando afuera.
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open && results[active]) {
              e.preventDefault();
              pick(results[active]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
        />
        {variant === 'field' && selected && !open && (
          <span className="picker__hint">
            {selected.name} · <b className={`t-${tone(selected.changePct)}`}>{money(selected.last)}</b>
          </span>
        )}
        {variant === 'top' && <kbd className="picker__kbd">/</kbd>}
      </div>
      {open && (
        <ul className="picker__list" id={listId} role="listbox">
          {results.length === 0 && <li className="picker__empty">Sin resultados para “{text}”</li>}
          {results.map((q, i) => (
            <li
              key={q.symbol}
              id={`${listId}-${q.symbol}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(q);
              }}
            >
              <span className="ticker-badge" style={{ ['--c' as string]: SECTOR_COLOR[q.sector] }}>
                {q.symbol.slice(0, 4)}
              </span>
              <span className="picker__name">
                <b>{q.symbol}</b>
                <small>{q.name !== q.symbol ? q.name : q.sector}</small>
              </span>
              <span className="picker__px">
                {money(q.last)}
                <small className={`t-${tone(q.changePct)}`}>{signedPct(q.changePct)}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
