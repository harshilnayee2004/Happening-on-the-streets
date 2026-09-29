import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { realtorLinks } from '../../shared/nav.js';
import { listingErrorFromAxios } from '../../buyer/listingErrors.js';
import HomePhoto from '../../buyer/components/HomePhoto.jsx';
import { formatPrice } from '../../buyer/format.js';
import QrCode from '../../shared/QrCode.jsx';

export default function CreateWorkspace() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    setCreated(null);
    try {
      await ensureGuest();
      const { data } = await api.post('/api/realtor/workspaces', { url: url.trim() });
      setUrl('');
      setCreated({
        property: data.property,
        workspace: data.workspace,
        link: `${window.location.origin}/w/${data.token}`,
      });
    } catch (err) {
      setError(listingErrorFromAxios(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created?.link) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Page
      eyebrow="Realtor"
      title="Create workspace"
      lede="Paste a Zillow or Realtor.com link. Hapstr imports the listing and gives you a buyer link."
      links={realtorLinks}
      shellNote={false}
    >
      <form className="import-form import-form--large" onSubmit={onSubmit}>
        <label htmlFor="realtor-listing">Paste a listing link</label>
        <div className="import-row">
          <input
            id="realtor-listing"
            type="url"
            inputMode="url"
            autoComplete="off"
            required
            placeholder="https://www.zillow.com/homedetails/…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create workspace'}
          </button>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : (
          <p className="form-hint">No account needed to start. Login is how you keep it later.</p>
        )}
      </form>

      {created ? (
        <article className="home-card">
          <HomePhoto src={created.property.photoUrls?.[0]} alt={created.property.title || created.property.address} />
          <div className="home-body">
            <p className="home-price">{formatPrice(created.property.priceCents)}</p>
            <h3>{created.property.title || created.property.address}</h3>
            <p className="muted">Buyer invite. Anyone with this link can open the home and chat. Same token as /w/:token.</p>
            <div className="qr-block">
              <QrCode value={created.link} label="Door QR for this workspace" />
              <p className="muted">Scan at the door to open the workspace.</p>
            </div>
            <div className="import-row">
              <input readOnly value={created.link} onFocus={(event) => event.target.select()} />
              <button type="button" className="button" onClick={copy}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <p className="home-actions home-actions--row">
              <Link className="button" to={`/workspace/${created.workspace.id}`}>Open the room</Link>
              <button type="button" className="button button--quiet" onClick={() => navigate('/realtor/dashboard')}>
                Dashboard
              </button>
            </p>
          </div>
        </article>
      ) : null}
    </Page>
  );
}
