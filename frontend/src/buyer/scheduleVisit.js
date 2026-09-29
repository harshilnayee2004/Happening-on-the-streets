export function googleCalendarUrl({ title, address, start, minutes = 45 }) {
  const begin = start instanceof Date ? start : new Date(start);
  if (Number.isNaN(begin.getTime())) return '';
  const end = new Date(begin.getTime() + minutes * 60 * 1000);
  const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Home visit',
    details: address || '',
    location: address || '',
    dates: `${stamp(begin)}/${stamp(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
