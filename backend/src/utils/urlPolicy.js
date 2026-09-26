import { HttpError } from './httpError.js';

const MAX_URL_LENGTH = 2000;

function isIpv4(host) {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export function isBlockedAddress(hostname) {
  if (typeof hostname !== 'string' || hostname.length === 0) return true;
  const trimmed = hostname.toLowerCase().replace(/\.$/, '');
  const bare = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
  if (
    bare === 'localhost' ||
    bare.endsWith('.localhost') ||
    bare.endsWith('.local') ||
    bare.endsWith('.internal')
  ) {
    return true;
  }
  if (/^\d+$/.test(bare)) return true;
  if (isIpv4(bare) || bare.includes(':')) return true;
  return false;
}

export function isNonPublicIp(address) {
  if (typeof address !== 'string' || address.length === 0) return true;
  const bare = address.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (bare.includes(':')) {
    if (bare === '::' || bare === '::1') return true;
    if (bare.startsWith('fc') || bare.startsWith('fd') || bare.startsWith('fe80')) return true;
    return false;
  }
  const parts = bare.split('.');
  if (parts.length !== 4) return true;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 168 || b === 0)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

export function assertHttpsUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() !== raw || raw.length === 0 || raw.length > MAX_URL_LENGTH) {
    throw new HttpError(400, 'invalid_url');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'invalid_url');
  }
  if (url.protocol !== 'https:') throw new HttpError(400, 'invalid_url');
  if (url.username || url.password) throw new HttpError(400, 'invalid_url');
  if (url.port && url.port !== '443') throw new HttpError(400, 'invalid_url');
  if (isBlockedAddress(url.hostname)) throw new HttpError(400, 'invalid_url');
  return url;
}
