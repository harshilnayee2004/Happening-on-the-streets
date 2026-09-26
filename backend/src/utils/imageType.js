export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const TYPES = Object.freeze({
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});

export function imageType(bytes) {
  if (!bytes || typeof bytes.length !== 'number' || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    return null;
  }
  const view = bytes instanceof Uint8Array ? bytes : null;
  if (!view) return null;
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return TYPES.jpeg;
  if (
    view.length >= 8
    && view[0] === 0x89
    && view[1] === 0x50
    && view[2] === 0x4e
    && view[3] === 0x47
    && view[4] === 0x0d
    && view[5] === 0x0a
    && view[6] === 0x1a
    && view[7] === 0x0a
  ) {
    return TYPES.png;
  }
  if (view.length >= 12 && ascii(view, 0, 4) === 'RIFF' && ascii(view, 8, 12) === 'WEBP') return TYPES.webp;
  return null;
}

function ascii(view, start, end) {
  let text = '';
  for (let i = start; i < end; i += 1) text += String.fromCharCode(view[i]);
  return text;
}
