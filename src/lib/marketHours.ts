/**
 * Horario de la rueda de BYMA para acciones y CEDEARs: 11:00 a 17:00, hora de Buenos Aires (UTC−3, sin horario de verano).
 * Se extiende 30 min después del cierre porque data912 publica con demora.
 * No contempla feriados: en un feriado se sigue refrescando, pero el precio no cambia.
 */
const OPEN_MIN = 11 * 60;
const CLOSE_MIN = 17 * 60 + 30;

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function isMarketOpen(now = new Date()): boolean {
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return false;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= OPEN_MIN && minutes < CLOSE_MIN;
}
