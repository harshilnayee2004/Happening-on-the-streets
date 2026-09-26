import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { realtorLinks } from '../../shared/nav.js';
import HomePhoto from '../../buyer/components/HomePhoto.jsx';
import ShareHome from '../../buyer/components/ShareHome.jsx';
import { formatPrice } from '../../buyer/format.js';

export default function Dashboard() {
  const [listings, setListings] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    ensureGuest()
      .then(() => api.get('/api/realtor/dashboard'))
      .then(({ data }) => {
        if (!cancelled) {
          setListings(data.listings);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) setError('The dashboard could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page
      eyebrow="Realtor"
      title="Dashboard"
      lede="Factual engagement for the homes you published. Private buyer notes stay off this page."
      links={realtorLinks}
      shellNote={false}
    >
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {!ready ? <p className="muted">Loading listings…</p> : null}
      {ready && listings.length === 0 ? (
        <div className="empty">
          <p>No published workspaces yet.</p>
          <p className="muted"><Link to="/realtor/create">Create a workspace</Link> from a listing link.</p>
        </div>
      ) : null}
      {listings.map((item) => {
        const title = item.property.title || item.property.address;
        return (
          <article className="home-card" key={item.workspace.id}>
            <HomePhoto src={item.property.photoUrls?.[0]} alt={title} />
            <div className="home-body">
              <p className="home-price">{formatPrice(item.property.priceCents)}</p>
              <h3>{title}</h3>
              <ul className="signal-row">
                <li><strong>{item.visitors}</strong> buyers in the room</li>
                <li><strong>{item.messages}</strong> messages</li>
                <li><strong>{item.visits}</strong> open-house albums</li>
              </ul>
              {item.lastMessage ? (
                <p className="last-message">
                  <strong>{item.lastMessage.isYou ? 'You' : item.lastMessage.authorName}:</strong>
                  {' '}
                  {item.lastMessage.body}
                </p>
              ) : (
                <p className="muted">No buyer chat yet.</p>
              )}
              <p className="home-actions home-actions--row">
                <Link className="button" to={`/workspace/${item.workspace.id}`}>Open workspace</Link>
                <ShareHome propertyId={item.property.id} />
              </p>
            </div>
          </article>
        );
      })}
    </Page>
  );
}
