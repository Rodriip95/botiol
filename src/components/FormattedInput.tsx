import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react';

/** Cantidad de dígitos y comas antes de la posición `pos`: lo que el formateo no agrega ni quita. */
const significantBefore = (s: string, pos: number) => s.slice(0, pos).replace(/[^\d,]/g, '').length;

/**
 * Input que reformatea el valor en cada tecla (ej. separador de miles) sin mandar el cursor al final.
 */
export function FormattedInput({
  value,
  format,
  onValueChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  format: (raw: string) => string;
  onValueChange: (formatted: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pendingCaret.current !== null && document.activeElement === el) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });

  return (
    <input
      {...rest}
      ref={ref}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const caret = e.target.selectionStart ?? raw.length;
        // Un punto recién tipeado que el formateo convierte en coma decimal cuenta como significativo.
        const typedDecimalDot = raw[caret - 1] === '.' && !raw.includes(',');
        const formatted = format(raw);
        let want = significantBefore(raw, caret) + (typedDecimalDot && formatted.includes(',') ? 1 : 0);
        let pos = 0;
        while (pos < formatted.length && want > 0) {
          if (/[\d,]/.test(formatted[pos]!)) want--;
          pos++;
        }
        if (formatted === value) {
          // Sin cambio de estado no hay re-render: React restaura el valor y el cursor salta al final.
          const el = e.target;
          requestAnimationFrame(() => el.setSelectionRange(pos, pos));
          return;
        }
        pendingCaret.current = pos;
        onValueChange(formatted);
      }}
    />
  );
}
