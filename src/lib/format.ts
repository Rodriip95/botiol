const ars2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ars0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const pct2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const usd2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (x: number) => `$ ${ars2.format(x)}`;
/** Monto para mostrar dentro de un input (sin "$", que ya está como prefijo). */
export const amountInput = (x: number) => ars2.format(x);
export const money0 = (x: number) => `$ ${ars0.format(x)}`;
export const usd = (x: number) => `US$ ${usd2.format(x)}`;
export const int = (x: number) => ars0.format(x);
export const short = (x: number) => compact.format(x);
export const pct = (x: number) => `${pct2.format(x)} %`;
export const signedPct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pct(Math.abs(x))}`;
const pct1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Versión compacta para etiquetas de gráficos: "+46,0%". */
export const signedPctShort = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pct1.format(Math.abs(x))}%`;
export const signedMoney0 = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${money0(Math.abs(x))}`;
export const signedMoney = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${money(Math.abs(x))}`;

export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const tone = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : 'flat');
