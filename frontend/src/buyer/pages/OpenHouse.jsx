import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { openHouseLinks } from '../../shared/nav.js';
import HomePhoto from '../components/HomePhoto.jsx';
import { formatPrice, homeFacts, showAddress } from '../format.js';

function visitErrorMessage(code, fallback) {
  if (code === 'invalid_photo' || code === 'unsupported_media_type') {
    return 'Use a JPEG, PNG, or WebP photo.';
  }
  if (code === 'payload_too_large') return 'That photo is too large. Keep it under 8 MB.';
  if (code === 'not_found') return 'That visit is not saved for this guest.';
  if (code === 'unauthenticated') return 'Start again as a guest, then try the visit.';
  return fallback;
}

function AlbumPhoto({ visitId, photoId }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    api.get(`/api/buyer/visits/${visitId}/photos/${photoId}`, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visitId, photoId]);

  if (failed || !src) {
    return <p className="album-photo album-photo--pending">{failed ? 'Photo could not be shown' : 'Loading photo'}</p>;
  }
  return (
    <img
      className="album-photo"
      src={src}
      alt="Album photo"
      onError={() => setFailed(true)}
    />
  );
}

function VisitCard({ property, visit, onSaved }) {
  const ids = useId();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = property.title || property.address;
  const facts = homeFacts(property);

  async function run(action) {
    setError('');
    setBusy(true);
    try {
      await ensureGuest();
      await action();
      await onSaved();
    } catch (err) {
      setError(visitErrorMessage(err.response?.data?.error, 'The visit could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  async function startVisit() {
    await run(() => api.post('/api/buyer/visits', { propertyId: property.id }));
  }

  async function addNote(event) {
    event.preventDefault();
    const body = note.trim();
    await run(async () => {
      await api.post(`/api/buyer/visits/${visit.id}/notes`, { body });
      setNote('');
    });
  }

  async function addPhotos(event) {
    const input = event.target;
    const files = [...input.files];
    input.value = '';
    if (files.length === 0) return;
    await run(async () => {
      for (const file of files) {
        await api.post(`/api/buyer/visits/${visit.id}/photos`, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
      }
    });
  }

  return (
    <article className="home-card">
      <HomePhoto src={property.photoUrls?.[0]} alt={title} />
      <div className="home-body">
        <p className="home-price">{formatPrice(property.priceCents)}</p>
        <h3>{title}</h3>
        {showAddress(property) ? <p className="home-address">{property.address}</p> : null}
        {facts.length > 0 ? (
          <ul className="home-facts">
            {facts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
        ) : null}

        {!visit ? (
          <div className="visit-start">
            <p className="muted">Walking through this one? Keep what you notice here.</p>
            <button type="button" className="button" disabled={busy} onClick={startVisit}>
              {busy ? 'Starting…' : 'Start the album'}
            </button>
          </div>
        ) : (
          <section className="album" aria-label={`Album for ${title}`}>
            <div className="section-head">
              <h4>Private album</h4>
              <p className="count">
                {visit.notes.length} {visit.notes.length === 1 ? 'note' : 'notes'} · {visit.photos.length}{' '}
                {visit.photos.length === 1 ? 'photo' : 'photos'}
              </p>
            </div>

            {visit.notes.length > 0 ? (
              <ul className="note-list">
                {visit.notes.map((item) => <li key={item.id}>{item.body}</li>)}
              </ul>
            ) : null}
            <form className="album-form" onSubmit={addNote}>
              <label htmlFor={`${ids}-note`}>What did you notice?</label>
              <textarea
                id={`${ids}-note`}
                name="note"
                required
                maxLength={2000}
                rows={3}
                placeholder="Morning light in the kitchen. Street is quieter than it looked."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <button type="submit" className="button" disabled={busy}>Add note</button>
            </form>

            {visit.photos.length > 0 ? (
              <ul className="album-photos">
                {visit.photos.map((item) => (
                  <li key={item.id}><AlbumPhoto visitId={visit.id} photoId={item.id} /></li>
                ))}
              </ul>
            ) : null}
            <div className="photo-picker">
              <p id={`${ids}-photo-label`}>Add a photo</p>
              <div className="photo-picker-actions">
                <label className="button">
                  Take a photo
                  <input
                    className="file-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={busy}
                    aria-labelledby={`${ids}-photo-label`}
                    onChange={addPhotos}
                  />
                </label>
                <label className="button button--quiet">
                  Upload photos
                  <input
                    className="file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={busy}
                    aria-labelledby={`${ids}-photo-label`}
                    onChange={addPhotos}
                  />
                </label>
              </div>
              <p className="form-hint">From your camera or photo library. JPEG, PNG, or WebP, up to 8 MB.</p>
            </div>
          </section>
        )}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    </article>
  );
}

export default function OpenHouse() {
  const { properties, ready, loadError } = useGuestWorkspace();
  const [visits, setVisits] = useState([]);
  const [visitsReady, setVisitsReady] = useState(false);
  const [visitsError, setVisitsError] = useState('');

  async function refreshVisits() {
    await ensureGuest();
    const { data } = await api.get('/api/buyer/visits');
    setVisits(data.visits);
    setVisitsError('');
  }

  useEffect(() => {
    let cancelled = false;
    refreshVisits()
      .catch(() => {
        if (!cancelled) setVisitsError('Visits could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setVisitsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visitByProperty = new Map(visits.map((visit) => [visit.propertyId, visit]));
  const loading = !ready || !visitsReady;

  return (
    <Page
      eyebrow="Open House Tools"
      title="Open House"
      lede="One private album per home for the things a listing never tells you."
      links={openHouseLinks}
      shellNote={false}
    >
      <section className="saved" aria-label="Visits">
        <div className="section-head">
          <h2>Your homes</h2>
          {ready && properties.length > 0 ? <p className="count">{properties.length} saved</p> : null}
        </div>
        {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}
        {visitsError ? <p className="form-error" role="alert">{visitsError}</p> : null}
        {loading && !loadError && !visitsError ? <p className="muted">Loading your homes…</p> : null}
        {ready && properties.length === 0 ? (
          <div className="empty">
            <p>No homes to visit yet.</p>
            <p className="muted">
              Save one on <Link to="/collect">Collect</Link> first, then come back here before the open house.
            </p>
          </div>
        ) : null}
        {!loading && properties.map((property) => (
          <VisitCard
            key={property.id}
            property={property}
            visit={visitByProperty.get(property.id)}
            onSaved={refreshVisits}
          />
        ))}
      </section>
    </Page>
  );
}
