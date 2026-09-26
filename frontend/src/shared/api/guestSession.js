import { api } from './client.js';
import { readGuestToken, writeGuestToken } from './guestToken.js';

let inflight = null;

export function ensureGuest() {
  const existing = readGuestToken();
  if (existing) return Promise.resolve(existing);
  if (!inflight) {
    inflight = api.post('/api/auth/guest').then(({ data }) => {
      writeGuestToken(data.token);
      return data.token;
    }).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
