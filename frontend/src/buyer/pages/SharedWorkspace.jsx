import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { openHouseLinks } from '../../shared/nav.js';
import { markChatSeen } from '../chatSeen.js';
import ChatBody from '../components/ChatBody.jsx';
import HomePhoto from '../components/HomePhoto.jsx';
import RoomPicker from '../components/RoomPicker.jsx';
import TrueMonthlyCost from '../components/TrueMonthlyCost.jsx';
import { formatPrice, homeFacts, showAddress } from '../format.js';
import { mentionDraft, photoForRoom, ROOM_OPTIONS, roomLabel } from '../rooms.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function roomError(code) {
  if (code === 'not_found') return 'This invite is not valid, or the room is not open to you.';
  if (code === 'unauthenticated') return 'Start again as a guest, then open the link.';
  return 'This workspace could not be opened.';
}

function messageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

export default function SharedWorkspace() {
  const { token, tokenOrId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { refresh } = useGuestWorkspace();
  const key = token || tokenOrId;
  const invite = pathname.startsWith('/w/');
  const logRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [labels, setLabels] = useState([]);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [focusSlug, setFocusSlug] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function open() {
      setError('');
      if (!room) setReady(false);
      await ensureGuest();
      const data = !invite && UUID.test(key)
        ? (await api.get(`/api/buyer/workspaces/${key}`)).data
        : (await api.post('/api/buyer/workspaces/join', { token: key })).data;
      if (cancelled) return;
      setRoom(data);
      setLabels(data.photoLabels || []);
      const you = data.members.find((member) => member.isYou);
      if (you && you.displayName !== 'Guest' && you.displayName !== 'Host') {
        setName(you.displayName);
      }
      if (invite || !UUID.test(key)) {
        navigate(`/workspace/${data.workspace.id}`, { replace: true });
      }
      await refresh();
    }
    open()
      .catch((err) => {
        if (!cancelled) setError(roomError(err.response?.data?.error));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key, invite, navigate, refresh]);

  useEffect(() => {
    if (!room?.workspace.id) return undefined;
    let cancelled = false;
    async function loadMessages() {
      try {
        const { data } = await api.get(`/api/buyer/workspaces/${room.workspace.id}/messages`);
        if (cancelled) return;
        setMessages(data.messages);
        const last = data.messages[data.messages.length - 1];
        if (last) markChatSeen(room.workspace.id, last.id);
      } catch {
        if (!cancelled) setError((current) => current || 'Chat could not be loaded.');
      }
    }
    loadMessages();
    const timer = window.setInterval(loadMessages, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [room?.workspace.id]);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  async function send(event) {
    event.preventDefault();
    if (!room || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      if (name.trim()) {
        await api.post('/api/buyer/profile', { displayName: name.trim() });
      }
      const { data } = await api.post(`/api/buyer/workspaces/${room.workspace.id}/messages`, {
        body: draft.trim(),
      });
      setMessages(data.messages);
      const last = data.messages[data.messages.length - 1];
      if (last) markChatSeen(room.workspace.id, last.id);
      setDraft('');
    } catch {
      setError('The message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function tagPhoto(photoUrl, nextRoom) {
    if (!room) return;
    try {
      const { data } = await api.post(`/api/buyer/workspaces/${room.workspace.id}/photo-labels`, {
        photoUrl,
        room: nextRoom,
      });
      setLabels(data.photoLabels);
    } catch {
      setError('That photo could not be tagged.');
    }
  }

  function insertMention(slug) {
    setDraft((current) => {
      if (/(^|\s)@[a-z0-9-]*$/i.test(current)) {
        return current.replace(/(^|\s)@[a-z0-9-]*$/i, `$1@${slug} `);
      }
      return `${current}${current && !current.endsWith(' ') ? ' ' : ''}@${slug} `;
    });
  }

  if (!ready && !room) {
    return (
      <Page
        eyebrow="Open House Tools"
        title="Workspace"
        lede="Opening the shared home."
        links={openHouseLinks}
        shellNote={false}
      >
        <p className="muted">Joining the room…</p>
      </Page>
    );
  }

  if (error && !room) {
    return (
      <Page
        eyebrow="Open House Tools"
        title="Workspace"
        lede="This invite could not be used."
        links={openHouseLinks}
        shellNote={false}
      >
        <p className="form-error" role="alert">{error}</p>
        <p><Link to="/workspace">Back to your rooms</Link></p>
      </Page>
    );
  }

  const property = room.property;
  const title = property.title || property.address;
  const facts = homeFacts(property);
  const people = room.members.filter((member) => !member.isYou).map((member) => member.displayName);
  const who = people.length > 0 ? people.join(', ') : 'Just you so far';
  const photos = property.photoUrls || [];
  const focusedUrl = focusSlug ? photoForRoom(photos, labels, focusSlug) : '';
  const heroUrl = focusedUrl || photos[0];
  const lookingAt = focusSlug && focusedUrl ? roomLabel(focusSlug) : 'Whole house';
  const typed = mentionDraft(draft);
  const suggestions = typed || draft.endsWith('@') || /(?:^|\s)@$/.test(draft)
    ? ROOM_OPTIONS.filter(([slug]) => !typed || slug.startsWith(typed)).slice(0, 8)
    : [];
  const labelFor = (url) => labels.find((item) => item.photoUrl === url)?.room || '';

  return (
    <Page
      eyebrow="Open House Tools"
      title={title}
      lede="Talk about the house here. Type @room or @kitchen to point at a photo."
      links={openHouseLinks}
      shellNote={false}
    >
      <div className="workspace-split">
        <article className="home-card workspace-home">
          <div className={focusSlug && focusedUrl ? 'photo-focus' : undefined}>
            <HomePhoto src={heroUrl} alt={lookingAt} />
            <p className="photo-focus-label">{lookingAt}</p>
          </div>
          <div className="home-body">
            <p className="home-price">{formatPrice(property.priceCents)}</p>
            {showAddress(property) ? <p className="home-address">{property.address}</p> : null}
            {facts.length > 0 ? (
              <ul className="home-facts">
                {facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            ) : null}
            {photos.length > 0 ? (
              <ul className="listing-photos listing-photos--taggable">
                {photos.map((url, index) => (
                  <li key={url}>
                    <button
                      type="button"
                      className={url === heroUrl ? 'photo-thumb photo-thumb--on' : 'photo-thumb'}
                      onClick={() => {
                        const tagged = labelFor(url);
                        setFocusSlug(tagged || (index === 0 ? '' : 'room'));
                      }}
                    >
                      <HomePhoto src={url} alt={labelFor(url) ? roomLabel(labelFor(url)) : `Photo ${index + 1}`} />
                    </button>
                    <RoomPicker
                      value={labelFor(url)}
                      onChange={(next) => tagPhoto(url, next)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            <TrueMonthlyCost
              purchasePrice={property.priceCents == null ? '' : property.priceCents / 100}
            />
          </div>
        </article>

        <section className="chat-panel" aria-label="Workspace chat">
          <header className="chat-top">
            <div>
              <h2>Chat</h2>
              <p className="muted">{who}</p>
            </div>
            <label className="chat-name">
              <span>Name</span>
              <input
                maxLength={40}
                placeholder="You"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          </header>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <ol className="chat-log" ref={logRef}>
            {messages.length === 0 ? (
              <li className="chat-empty">Try “the light in @kitchen is better in person.”</li>
            ) : null}
            {messages.map((item) => (
              <li key={item.id} className={item.isYou ? 'bubble bubble--you' : 'bubble'}>
                <span className="bubble-meta">
                  {item.isYou ? 'You' : item.authorName}
                  {messageTime(item.createdAt) ? ` · ${messageTime(item.createdAt)}` : ''}
                </span>
                <ChatBody text={item.body} onMention={setFocusSlug} />
              </li>
            ))}
          </ol>
          {suggestions.length > 0 ? (
            <ul className="mention-list">
              {suggestions.map(([slug, label]) => (
                <li key={slug}>
                  <button type="button" onClick={() => insertMention(slug)}>
                    @{slug}
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <form className="chat-compose" onSubmit={send}>
            <label className="visually-hidden" htmlFor="chat-draft">Message</label>
            <input
              id="chat-draft"
              name="message"
              required
              maxLength={2000}
              autoComplete="off"
              placeholder="Message · type @room"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="button" disabled={sending}>
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </section>
      </div>
    </Page>
  );
}
