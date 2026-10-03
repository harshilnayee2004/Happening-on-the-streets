import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';

const DEMO_WORKSPACE_ID = 'ws_hapstr_demo_home';

export default function ViewDemo({ className = 'button button--quiet' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    setError('');
    setBusy(true);
    try {
      await ensureGuest();
      await api.get(`/api/buyer/workspaces/${DEMO_WORKSPACE_ID}`);
      navigate(`/workspace/${DEMO_WORKSPACE_ID}`);
    } catch (err) {
      if (err?.code === 'ECONNABORTED' || !err?.response) {
        setError('The server is waking up — wait a minute, then try View demo again.');
      } else {
        setError('The demo home could not be opened.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="view-demo">
      <button type="button" className={className} disabled={busy} onClick={open}>
        {busy ? 'Opening demo…' : 'View demo'}
      </button>
      {error ? <span className="form-error" role="alert">{error}</span> : null}
    </span>
  );
}
