import { WebSocketServer } from 'ws';
import { verifyActorToken } from './middleware/auth.js';
import { runWithActor } from './middleware/rls.js';
import { listWorkspaceChat, postWorkspaceChat } from './services/dataAccess.js';

const rooms = new Map();

function addSocket(workspaceId, socket) {
  if (!rooms.has(workspaceId)) rooms.set(workspaceId, new Set());
  rooms.get(workspaceId).add(socket);
}

function dropSocket(workspaceId, socket) {
  const set = rooms.get(workspaceId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) rooms.delete(workspaceId);
}

function sendJson(socket, payload) {
  if (socket.readyState === 1) socket.send(JSON.stringify(payload));
}

export function attachChatSocket(server) {
  const wss = new WebSocketServer({ server, path: '/api/chat' });
  wss.on('error', (err) => {
    console.error('Chat socket server error:', err);
  });
  wss.on('connection', (socket, req) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const workspaceId = url.searchParams.get('workspaceId') || '';
    const token = url.searchParams.get('guest') || '';
    let actor;
    try {
      actor = verifyActorToken(token);
    } catch {
      socket.close(4401, 'unauthenticated');
      return;
    }
    let messages;
    try {
      messages = runWithActor(actor, () => listWorkspaceChat(workspaceId));
    } catch {
      socket.close(4404, 'not_found');
      return;
    }
    addSocket(workspaceId, socket);
    sendJson(socket, { type: 'snapshot', messages });
    socket.on('message', (raw) => {
      let payload;
      try {
        payload = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (payload?.type !== 'chat' || typeof payload.body !== 'string') return;
      try {
        const next = runWithActor(actor, () => postWorkspaceChat(workspaceId, payload.body));
        const last = next[next.length - 1];
        for (const peer of rooms.get(workspaceId) || []) {
          sendJson(peer, { type: 'message', message: last, messages: next });
        }
      } catch {
        sendJson(socket, { type: 'error', error: 'invalid_input' });
      }
    });
    socket.on('error', () => dropSocket(workspaceId, socket));
    socket.on('close', () => dropSocket(workspaceId, socket));
  });
  return wss;
}
