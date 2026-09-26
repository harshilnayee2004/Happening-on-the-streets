import axios from 'axios';
import { readGuestToken } from './guestToken.js';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';

export const api = axios.create({
  baseURL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = readGuestToken();
  if (token) {
    config.headers['X-Guest-Token'] = token;
  }
  return config;
});
