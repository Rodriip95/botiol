const money2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const money = (x: number) => `$ ${money2.format(x)}`;
export const pct = (x: number) => `${pct1.format(x)} %`;
export const signedMoney = (x: number) => (x < 0 ? `−${money(-x)}` : `+${money(x)}`);
