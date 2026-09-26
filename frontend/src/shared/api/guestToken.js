const GUEST_TOKEN_KEY = 'hapstr.guestToken';

export function readGuestToken() {
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

export function writeGuestToken(token) {
  localStorage.setItem(GUEST_TOKEN_KEY, token);
}

export function clearGuestToken() {
  localStorage.removeItem(GUEST_TOKEN_KEY);
}
