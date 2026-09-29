import { useId, useState } from 'react';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { listingErrorFromAxios } from '../listingErrors.js';

export default function ListingImportForm({
  onSaved,
  buttonLabel = 'Save this home',
  hint = 'Works with Zillow and Realtor.com links. No account needed.',
  autoFocus = false,
  large = false,
}) {
  const { refresh } = useGuestWorkspace();
  const inputId = useId();
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setImporting(true);
    try {
      await ensureGuest();
      const { data } = await api.post('/api/buyer/listings', { url: url.trim() });
      setUrl('');
      await refresh();
      if (onSaved) onSaved(data.property);
    } catch (err) {
      setError(listingErrorFromAxios(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <form className={large ? 'import-form import-form--large' : 'import-form'} onSubmit={onSubmit}>
      <label htmlFor={inputId}>Paste a listing link</label>
      <div className="import-row">
        <input
          id={inputId}
          name="listing-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoFocus={autoFocus}
          required
          placeholder="https://www.zillow.com/homedetails/…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
          aria-invalid={error ? 'true' : undefined}
        />
        <button type="submit" disabled={importing}>
          {importing ? 'Saving…' : buttonLabel}
        </button>
      </div>
      {error ? (
        <p className="form-error" id={`${inputId}-error`} role="alert">{error}</p>
      ) : (
        <p className="form-hint" id={`${inputId}-hint`}>{hint}</p>
      )}
    </form>
  );
}
