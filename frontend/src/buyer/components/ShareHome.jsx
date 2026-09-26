import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';

function shareUrl(token) {
  return `${window.location.origin}/w/${token}`;
}

export default function ShareHome({ propertyId }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [copied, setCopied] = useState(false);

  async function createLink() {
    setError('');
    setCopied(false);
    setBusy(true);
    try {
      await ensureGuest();
      const { data } = await api.post(`/api/buyer/listings/${propertyId}/share`);
      setLink(shareUrl(data.token));
      setWorkspaceId(data.workspace.id);
      setOpen(true);
    } catch {
      setError('The share link could not be created.');
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button type="button" className="button button--quiet" disabled={busy} onClick={createLink}>
        {busy ? 'Creating link…' : 'Share a link'}
      </button>
      {open ? (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={`share-${propertyId}`}>
            <h2 id={`share-${propertyId}`}>Share this home</h2>
            <p>
              Anyone with this link can open the listing, look at the photos, and chat with you about it.
              They do not need an account.
            </p>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {link ? (
              <>
                <label className="share-link-label" htmlFor={`share-url-${propertyId}`}>Invite link</label>
                <div className="import-row">
                  <input id={`share-url-${propertyId}`} readOnly value={link} onFocus={(event) => event.target.select()} />
                  <button type="button" className="button" onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </>
            ) : null}
            <div className="dialog-actions">
              {workspaceId ? (
                <Link className="button" to={`/workspace/${workspaceId}`} onClick={() => setOpen(false)}>
                  Open workspace
                </Link>
              ) : null}
              <button className="button button--quiet" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
