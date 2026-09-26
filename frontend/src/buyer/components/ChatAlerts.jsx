import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { isOpenHousePath } from '../../shared/nav.js';
import { lastSeenMessage, markChatSeen } from '../chatSeen.js';

function roomPath(pathname) {
  const match = /^\/workspace\/([^/]+)$/.exec(pathname);
  return match?.[1] || '';
}

function homeTitle(property) {
  return property.title || property.address || 'A home';
}

export default function ChatAlerts() {
  const { pathname } = useLocation();
  const seenRef = useRef(new Set());
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!isOpenHousePath(pathname)) return undefined;
    let cancelled = false;

    async function poll() {
      try {
        await ensureGuest();
        const { data } = await api.get('/api/buyer/workspaces');
        if (cancelled) return;
        const openId = roomPath(pathname);
        const next = [];
        for (const room of data.rooms) {
          const message = room.lastMessage;
          if (!message || message.isYou) continue;
          if (room.workspace.id === openId) {
            markChatSeen(room.workspace.id, message.id);
            continue;
          }
          if (lastSeenMessage(room.workspace.id) === message.id) continue;
          if (seenRef.current.has(message.id)) continue;
          seenRef.current.add(message.id);
          next.push({
            id: message.id,
            workspaceId: room.workspace.id,
            home: homeTitle(room.property),
            author: message.authorName,
            body: message.body,
          });
        }
        if (next.length > 0) {
          setToasts((current) => [...next, ...current].slice(0, 3));
        }
      } catch {
        // Stay quiet while a guest has no rooms yet.
      }
    }

    poll();
    const timer = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname]);

  function dismiss(id, workspaceId) {
    if (workspaceId) markChatSeen(workspaceId, id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="chat-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div className="chat-toast" key={toast.id} role="status">
          <p className="chat-toast-home">{toast.home}</p>
          <p className="chat-toast-body">
            <strong>{toast.author}:</strong> {toast.body}
          </p>
          <div className="chat-toast-actions">
            <Link
              className="button"
              to={`/workspace/${toast.workspaceId}`}
              onClick={() => dismiss(toast.id, toast.workspaceId)}
            >
              Open chat
            </Link>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => dismiss(toast.id, toast.workspaceId)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
