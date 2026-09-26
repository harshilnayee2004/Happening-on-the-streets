const KEY = 'hapstr.chatSeen';

function readMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function lastSeenMessage(workspaceId) {
  const value = readMap()[workspaceId];
  return typeof value === 'string' ? value : '';
}

export function markChatSeen(workspaceId, messageId) {
  if (!workspaceId || !messageId) return;
  const next = readMap();
  next[workspaceId] = messageId;
  localStorage.setItem(KEY, JSON.stringify(next));
}
