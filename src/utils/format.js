/**
 * Formatting & text utilities
 */

export function formatHour(isoTime, index = 0) {
  if (!isoTime) return `+${index}h`;
  try {
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return `+${index}h`;
    const hrs = d.getHours();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const formatted = hrs % 12 || 12;
    return `${formatted} ${ampm}`;
  } catch {
    return `+${index}h`;
  }
}

export function capitalize(str = '') {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function sanitizeInputNumber(rawValue, maximum, minimum = 0) {
  const cleanStr = String(rawValue).replace(/^0+(?=\d)/, '');
  const parsed = parseInt(cleanStr, 10);
  if (!Number.isFinite(parsed)) return minimum;
  return Math.max(minimum, Math.min(maximum, parsed));
}
