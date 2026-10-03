/** Public Hapstr API (Render). Used when VITE_API_BASE_URL is missing on a hosted build. */
export const PRODUCTION_API_BASE_URL = 'https://happening-on-the-streets.onrender.com';

const LOCAL_API_BASE_URL = 'http://127.0.0.1:4000';

export function resolveApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }
  if (import.meta.env.PROD) return PRODUCTION_API_BASE_URL;
  return LOCAL_API_BASE_URL;
}
