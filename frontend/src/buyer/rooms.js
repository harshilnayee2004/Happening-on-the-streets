export const ROOM_OPTIONS = [
  ['room', 'Room'],
  ['kitchen', 'Kitchen'],
  ['living', 'Living room'],
  ['dining', 'Dining'],
  ['bedroom', 'Bedroom'],
  ['bathroom', 'Bathroom'],
  ['office', 'Office'],
  ['garage', 'Garage'],
  ['backyard', 'Backyard'],
  ['patio', 'Patio'],
  ['basement', 'Basement'],
  ['attic', 'Attic'],
  ['laundry', 'Laundry'],
  ['foyer', 'Foyer'],
  ['hallway', 'Hallway'],
  ['exterior', 'Exterior'],
];

export const ROOM_SLUGS = new Set(ROOM_OPTIONS.map(([slug]) => slug));

export function roomLabel(slug) {
  const match = ROOM_OPTIONS.find(([value]) => value === slug);
  return match ? match[1] : slug;
}

const MENTION = /@([a-z][a-z0-9-]{0,31})/gi;

export function parseMentions(text) {
  const parts = [];
  let last = 0;
  const source = String(text || '');
  for (const match of source.matchAll(MENTION)) {
    const slug = match[1].toLowerCase();
    if (!ROOM_SLUGS.has(slug)) continue;
    const start = match.index;
    if (start > last) parts.push({ type: 'text', value: source.slice(last, start) });
    parts.push({ type: 'mention', value: slug, raw: match[0] });
    last = start + match[0].length;
  }
  if (last < source.length) parts.push({ type: 'text', value: source.slice(last) });
  return parts.length > 0 ? parts : [{ type: 'text', value: source }];
}

export function lastRoomMention(text) {
  const mentions = parseMentions(text).filter((part) => part.type === 'mention');
  return mentions.at(-1)?.value || '';
}

export function mentionDraft(text) {
  const match = /(?:^|\s)@([a-z][a-z0-9-]{0,31})?$/i.exec(String(text || ''));
  if (!match) return '';
  return (match[1] || '').toLowerCase();
}

export function photoForRoom(photos, labels, slug) {
  const list = Array.isArray(photos) ? photos : [];
  const tagged = (labels || []).find((item) => item.room === slug);
  if (tagged && list.includes(tagged.photoUrl)) return tagged.photoUrl;
  if (slug === 'room' || slug === 'exterior') {
    return list[1] || list[0] || '';
  }
  return '';
}
