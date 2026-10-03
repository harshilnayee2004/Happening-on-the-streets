import { resolveApiBaseUrl } from '../shared/api/apiBaseUrl.js';
import { readGuestToken } from '../shared/api/guestToken.js';

export function workspaceChatUrl(workspaceId) {
  const base = resolveApiBaseUrl();
  const token = readGuestToken() || '';
  const root = String(base).replace(/\/$/, '').replace(/^http/, 'ws');
  const params = new URLSearchParams({
    workspaceId,
    guest: token,
  });
  return `${root}/api/chat?${params.toString()}`;
}
