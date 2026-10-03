/** Public Hapstr API (Render). Used when VITE_API_BASE_URL is missing on a hosted build. */
export const PRODUCTION_API_BASE_URL = 'https://happening-on-the-streets.onrender.com';

const LOCAL_API_BASE_URL = 'http://127.0.0.1:4000';

function normalizeBase(url) {
  return String(url).trim().replace(/\/$/, '');
}

function isLocalhostUrl(url) {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?/i.test(String(url));
}

function hostedInBrowser() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('.vercel.app') || host.endsWith('.hapstr.app');
}

export function resolveApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  const envBase = fromEnv && String(fromEnv).trim() ? normalizeBase(fromEnv) : '';

  if (hostedInBrowser()) {
    if (!envBase || isLocalhostUrl(envBase)) return PRODUCTION_API_BASE_URL;
    return envBase;
  }

  if (envBase) return envBase;
  if (import.meta.env.PROD) return PRODUCTION_API_BASE_URL;
  return LOCAL_API_BASE_URL;
}
