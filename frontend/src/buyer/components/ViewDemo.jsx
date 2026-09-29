import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';

export default function ViewDemo({ className = 'button button--quiet' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    setError('');
    setBusy(true);
    try {
      await ensureGuest();
      const { data } = await api.get('/api/buyer/demo');
      navigate(`/w/${data.token}`);
    } catch {
      setError('The demo home could not be opened.');
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
