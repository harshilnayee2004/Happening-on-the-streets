import axios from 'axios';
import { clearGuestToken, readGuestToken, writeGuestToken } from './guestToken.js';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';

export const api = axios.create({
  baseURL,
  timeout: 55000,
});

api.interceptors.request.use((config) => {
  const path = String(config.url || '');
  if (path.includes('/api/auth/guest')) {
    if (config.headers) delete config.headers['X-Guest-Token'];
    return config;
  }
  const token = readGuestToken();
  if (token) {
    config.headers['X-Guest-Token'] = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const config = error.config;
    const path = String(config?.url || '');
    const isGuestIssue = path.includes('/api/auth/guest');
    if (status === 401 && config && !config.__guestRetry && !isGuestIssue) {
      clearGuestToken();
      const { data } = await api.post('/api/auth/guest');
      writeGuestToken(data.token);
      config.__guestRetry = true;
      config.headers = config.headers || {};
      config.headers['X-Guest-Token'] = data.token;
      return api.request(config);
    }
    return Promise.reject(error);
  },
);
