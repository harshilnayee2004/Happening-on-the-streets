const GUEST_TOKEN_KEY = 'hapstr.guestToken';

function canUse(storage) {
  try {
    const probe = '__hapstr_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function storage() {
  if (typeof window === 'undefined') return null;
  if (canUse(window.localStorage)) return window.localStorage;
  if (canUse(window.sessionStorage)) return window.sessionStorage;
  return null;
}

export function readGuestToken() {
  const store = storage();
  if (!store) return '';
  return store.getItem(GUEST_TOKEN_KEY) || '';
}

export function writeGuestToken(token) {
  const store = storage();
  if (!store) return;
  store.setItem(GUEST_TOKEN_KEY, token);
}

export function clearGuestToken() {
  const store = storage();
  if (!store) return;
  store.removeItem(GUEST_TOKEN_KEY);
}
