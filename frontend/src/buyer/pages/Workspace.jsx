import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { openHouseLinks } from '../../shared/nav.js';
import HomePhoto from '../components/HomePhoto.jsx';
import OpenChat from '../components/OpenChat.jsx';
import ShareHome from '../components/ShareHome.jsx';
import DemoTag from '../components/DemoTag.jsx';
import { formatPrice, homeFacts } from '../format.js';

export default function Workspace() {
  const { properties, ready } = useGuestWorkspace();
  const [rooms, setRooms] = useState([]);
  const [roomsReady, setRoomsReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    ensureGuest()
      .then(() => api.get('/api/buyer/workspaces'))
      .then(({ data }) => {
        if (!cancelled) {
          setRooms(data.rooms);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Workspaces could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setRoomsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sharedIds = new Set(rooms.map((room) => room.property.id));

  return (
    <Page
      eyebrow="Open House Tools"
      title="Workspace"
      lede="Share a home with family. Anyone with the link can look at the listing and talk it through with you."
      links={openHouseLinks}
      shellNote={false}
    >
      <section className="saved" aria-label="Shared homes">
        <div className="section-head">
          <h2>Open rooms</h2>
          {roomsReady && rooms.length > 0 ? <p className="count">{rooms.length} open</p> : null}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {!roomsReady ? <p className="muted">Loading workspaces…</p> : null}
        {roomsReady && rooms.length === 0 ? (
          <div className="empty">
            <p>No one is in a room yet.</p>
            <p className="muted">Share a home from Collect. The people you send the link to will land here with you.</p>
          </div>
        ) : null}
        {rooms.map((room) => {
          const title = room.property.title || room.property.address;
          const facts = homeFacts(room.property);
          return (
            <article className="home-card" key={room.workspace.id}>
              <HomePhoto src={room.property.photoUrls?.[0]} alt={title} />
              <div className="home-body">
                <p className="home-price">
                  {formatPrice(room.property.priceCents)}
                  {room.property.isDemo ? <DemoTag /> : null}
                </p>
                <h3>{title}</h3>
                {facts.length > 0 ? (
                  <ul className="home-facts">
                    {facts.map((fact) => <li key={fact}>{fact}</li>)}
                  </ul>
                ) : null}
                <p className="muted">{room.isHost ? 'You started this room.' : 'You joined this room.'}</p>
                {room.lastMessage ? (
                  <p className="last-message">
                    <strong>{room.lastMessage.isYou ? 'You' : room.lastMessage.authorName}:</strong>
                    {' '}
                    {room.lastMessage.body}
                  </p>
                ) : (
                  <p className="last-message">No messages yet.</p>
                )}
                <p className="home-actions home-actions--row">
                  <Link className="button" to={`/workspace/${room.workspace.id}`}>Open chat</Link>
                  {room.isHost ? <ShareHome propertyId={room.property.id} /> : null}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      {ready && properties.some((property) => !sharedIds.has(property.id)) ? (
        <section className="saved" aria-label="Homes you can share">
          <div className="section-head">
            <h2>Your homes</h2>
          </div>
          {properties.filter((property) => !sharedIds.has(property.id)).map((property) => {
            const title = property.title || property.address;
            return (
              <article className="home-card" key={property.id}>
                <HomePhoto src={property.photoUrls?.[0]} alt={title} />
                <div className="home-body">
                  <p className="home-price">
                    {formatPrice(property.priceCents)}
                    {property.isDemo ? <DemoTag /> : null}
                  </p>
                  <h3>{title}</h3>
                  <p className="home-actions home-actions--row">
                    <OpenChat propertyId={property.id} />
                    <ShareHome propertyId={property.id} />
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </Page>
  );
}
