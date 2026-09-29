import { readGuestToken } from '../shared/api/guestToken.js';

export function workspaceChatUrl(workspaceId) {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';
  const token = readGuestToken() || '';
  const root = String(base).replace(/\/$/, '').replace(/^http/, 'ws');
  const params = new URLSearchParams({
    workspaceId,
    guest: token,
  });
  return `${root}/api/chat?${params.toString()}`;
}
