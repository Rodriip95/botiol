/**
 * Validaciones del formulario de la calculadora.
 * Acepta montos en formato argentino ("1.234.567,89") o con punto decimal ("1234567.89").
 */

export const MIN_DATE = '2010-01-01';
export const MAX_QUANTITY = 10_000_000;
export const MAX_INVESTED = 1e13;

export interface CalcForm {
  symbol: string;
  quantity: string;
  invested: string;
  date: string;
}

export interface ParsedCalc {
  symbol: string;
  quantity: number;
  invested: number;
  date: string | null;
}

export type CalcErrors = Partial<Record<keyof CalcForm, string>>;

/** Convierte un monto escrito por el usuario a número; null si no es válido. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s|\$/g, '');
  if (!s) return null;
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s)) {
    // es-AR: puntos de miles, coma decimal
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    // en-US: comas de miles, punto decimal
    normalized = s.replace(/,/g, '');
  } else if (/^\d+(\.\d+)?$/.test(s)) {
    normalized = s;
  } else {
    return null;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function todayIso(now = new Date()): string {
  // Fecha local, no UTC: a las 22 h de Argentina UTC ya es "mañana".
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function validateCalc(
  form: CalcForm,
  knownSymbols: ReadonlySet<string>,
  now = new Date(),
): { ok: true; value: ParsedCalc } | { ok: false; errors: CalcErrors } {
  const errors: CalcErrors = {};

  const symbol = form.symbol.trim().toUpperCase();
  if (!symbol) errors.symbol = 'Elegí el CEDEAR que compraste.';
  else if (!/^[A-Z0-9.]{1,12}$/.test(symbol)) errors.symbol = 'El ticker solo admite letras y números.';
  else if (knownSymbols.size > 0 && !knownSymbols.has(symbol)) errors.symbol = `No encontramos ${symbol} entre los CEDEARs.`;

  const qtyRaw = form.quantity.trim().replace(/\./g, '');
  const quantity = Number(qtyRaw);
  if (!qtyRaw) errors.quantity = 'Ingresá cuántos nominales compraste.';
  else if (!/^\d+$/.test(qtyRaw)) errors.quantity = 'Los nominales son un número entero, sin decimales.';
  else if (quantity < 1) errors.quantity = 'Tiene que ser al menos 1 nominal.';
  else if (quantity > MAX_QUANTITY) errors.quantity = 'Revisá la cantidad: es demasiado grande.';

  const invested = parseAmount(form.invested);
  if (!form.invested.trim()) errors.invested = 'Ingresá el total pagado.';
  else if (invested === null) errors.invested = 'Formato inválido. Ej.: 150.000,50';
  else if (invested <= 0) errors.invested = 'El monto tiene que ser mayor a cero.';
  else if (invested > MAX_INVESTED) errors.invested = 'Revisá el monto: es demasiado grande.';

  let date: string | null = null;
  if (form.date.trim()) {
    date = form.date.trim();
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime());
    if (!valid) errors.date = 'Fecha inválida.';
    else if (date > todayIso(now)) errors.date = 'La fecha no puede ser futura.';
    else if (date < MIN_DATE) errors.date = 'Usá una fecha desde 2010 en adelante.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { symbol, quantity, invested: invested!, date } };
}
