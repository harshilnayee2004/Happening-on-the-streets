import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';

export default function OpenChat({ propertyId }) {
  const navigate = useNavigate();
  const { rooms, refreshRooms } = useGuestWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const room = rooms.find((item) => item.property.id === propertyId);

  if (room) {
    return (
      <Link className="button" to={`/workspace/${room.workspace.id}`}>
        Open chat
      </Link>
    );
  }

  async function open() {
    setError('');
    setBusy(true);
    try {
      await ensureGuest();
      const { data } = await api.post(`/api/buyer/listings/${propertyId}/share`);
      await refreshRooms();
      navigate(data.property?.isDemo ? '/workspace/ws_hapstr_demo_home' : `/workspace/${data.workspace.id}`);
    } catch {
      setError('Chat could not be opened.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="button" disabled={busy} onClick={open}>
        {busy ? 'Opening…' : 'Open chat'}
      </button>
      {error ? <span className="form-error" role="alert">{error}</span> : null}
    </>
  );
}
