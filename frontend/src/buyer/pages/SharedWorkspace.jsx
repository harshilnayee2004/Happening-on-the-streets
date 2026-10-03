import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { openHouseLinks } from '../../shared/nav.js';
import { markChatSeen } from '../chatSeen.js';
import { workspaceChatUrl } from '../chatSocket.js';
import ChatBody from '../components/ChatBody.jsx';
import HomePhoto from '../components/HomePhoto.jsx';
import RoomSwitcher from '../components/RoomSwitcher.jsx';
import TrueMonthlyCost from '../components/TrueMonthlyCost.jsx';
import WorkspaceReadinessPanel from '../components/WorkspaceReadinessPanel.jsx';
import CesiumViewer from '../../shared/cesium/CesiumViewer.jsx';
import { formatPrice, homeFacts, showAddress } from '../format.js';
import DemoTag from '../components/DemoTag.jsx';
import { lastRoomMention, mentionDraft, photoForRoom, ROOM_OPTIONS, roomLabel } from '../rooms.js';

function roomError(err) {
  const code = err?.response?.data?.error;
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') {
      return 'The server is waking up (this can take up to a minute on free hosting). Wait, then tap Back and try again.';
    }
    return 'Could not reach the server. Check Wi‑Fi or mobile data, then try again.';
  }
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

function formatChatWho(members) {
  const others = members.filter((member) => !member.isYou);
  if (others.length === 0) return 'Just you in this room';
  const hosts = others.filter((member) => member.isHost);
  const guests = others.filter((member) => !member.isHost);
  const parts = [];
  if (hosts.length > 0) {
    const hostNames = [...new Set(hosts.map((member) => member.displayName || 'Host'))];
    parts.push(hostNames.join(', '));
  }
  if (guests.length === 1) {
    parts.push(guests[0].displayName || 'Guest');
  } else if (guests.length > 1) {
    parts.push(`${guests.length} guests`);
  }
  return parts.join(' · ');
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
  const [heroIndex, setHeroIndex] = useState(0);
  const [consent, setConsent] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function open() {
      setError('');
      if (!room) setReady(false);
      await ensureGuest();
      const data = invite
        ? (await api.post('/api/buyer/workspaces/join', { token: key })).data
        : (await api.get(`/api/buyer/workspaces/${key}`)).data;
      if (cancelled) return;
      setRoom(data);
      setLabels(data.photoLabels || []);
      const you = data.members.find((member) => member.isYou);
      if (you && you.displayName !== 'Guest' && you.displayName !== 'Host') {
        setName(you.displayName);
      }
      if (you) setConsent(you.consentGiven === true);
      if (invite) {
        navigate(`/workspace/${data.workspace.id}`, { replace: true });
      }
      await refresh();
    }
    open()
      .catch((err) => {
        if (!cancelled) setError(roomError(err));
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
    let timer;
    const apply = (list) => {
      if (cancelled || !Array.isArray(list)) return;
      setMessages(list);
      const last = list[list.length - 1];
      if (last) markChatSeen(room.workspace.id, last.id);
    };
    async function loadHttp() {
      try {
        const { data } = await api.get(`/api/buyer/workspaces/${room.workspace.id}/messages`);
        apply(data.messages);
      } catch {
        if (!cancelled) setError((current) => current || 'Chat could not be loaded.');
      }
    }
    api.get(`/api/buyer/workspaces/${room.workspace.id}/readiness`)
      .then(({ data }) => {
        if (!cancelled) setReadiness(data.readiness);
      })
      .catch(() => {});
    const socket = new WebSocket(workspaceChatUrl(room.workspace.id));
    socketRef.current = socket;
    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.messages) apply(payload.messages);
      } catch {
        /* ignore malformed frames */
      }
    });
    socket.addEventListener('open', () => loadHttp());
    socket.addEventListener('error', () => {
      loadHttp();
      if (!timer) timer = window.setInterval(loadHttp, 8000);
    });
    return () => {
      cancelled = true;
      socket.close();
      socketRef.current = null;
      if (timer) window.clearInterval(timer);
    };
  }, [room?.workspace.id]);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const typedRoom = lastRoomMention(draft);
    if (typedRoom) setFocusSlug(typedRoom);
  }, [draft]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    const sentRoom = last ? lastRoomMention(last.body) : '';
    if (sentRoom) setFocusSlug(sentRoom);
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    if (!room || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      if (name.trim()) {
        await api.post('/api/buyer/profile', { displayName: name.trim() });
      }
      const live = socketRef.current;
      if (live && live.readyState === WebSocket.OPEN) {
        live.send(JSON.stringify({ type: 'chat', body: draft.trim() }));
      } else {
        const { data } = await api.post(`/api/buyer/workspaces/${room.workspace.id}/messages`, {
          body: draft.trim(),
        });
        setMessages(data.messages);
        const last = data.messages[data.messages.length - 1];
        if (last) markChatSeen(room.workspace.id, last.id);
      }
      setDraft('');
    } catch {
      setError('The message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function saveConsent(next) {
    if (!room) return;
    setSavingConsent(true);
    try {
      await api.post(`/api/buyer/workspaces/${room.workspace.id}/consent`, { given: next });
      setConsent(next);
    } catch {
      setError('Consent could not be saved.');
    } finally {
      setSavingConsent(false);
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
  const who = formatChatWho(room.members);
  const showGuestConsent = room.members.some((member) => member.isYou && !member.isHost);
  const photos = property.photoUrls || [];
  const labelFor = (url) => labels.find((item) => item.photoUrl === url)?.room || '';
  const focusedUrl = focusSlug ? photoForRoom(photos, labels, focusSlug) : '';
  const safeIndex = photos.length === 0 ? 0 : Math.min(heroIndex, photos.length - 1);
  const heroUrl = (focusedUrl && photos.includes(focusedUrl) ? focusedUrl : photos[safeIndex]) || photos[0];
  const heroPos = Math.max(0, photos.indexOf(heroUrl));
  const lookingAt = labelFor(heroUrl) ? roomLabel(labelFor(heroUrl)) : 'Whole house';
  const typed = mentionDraft(draft);
  const suggestions = typed || draft.endsWith('@') || /(?:^|\s)@$/.test(draft)
    ? ROOM_OPTIONS.filter(([slug]) => !typed || slug.startsWith(typed)).slice(0, 8)
    : [];

  function showPhoto(index) {
    if (photos.length === 0) return;
    const next = (index + photos.length) % photos.length;
    setHeroIndex(next);
    setFocusSlug(labelFor(photos[next]) || '');
  }

  async function pickRoom(slug) {
    setFocusSlug(slug);
    const url = photoForRoom(photos, labels, slug);
    if (url && photos.includes(url)) {
      setHeroIndex(photos.indexOf(url));
      return;
    }
    if (heroUrl && slug) {
      await tagPhoto(heroUrl, slug);
    }
  }

  const activeRoomSlug = labelFor(heroUrl) || focusSlug || '';
  const has3d = Boolean(
    room.showcase?.modelUrl
    || (room.showcase?.latitude != null && room.showcase?.longitude != null),
  );

  return (
    <Page
      eyebrow="Open House Tools"
      title={title}
      lede="@kitchen in chat switches the hero photo."
      links={openHouseLinks}
      shellNote={false}
    >
      <div className="workspace-board">
        <article className="home-card workspace-home">
          <div className="workspace-main-grid">
            <div className="workspace-visual">
              <div className="workspace-hero-frame">
                <HomePhoto key={heroUrl || 'empty'} src={heroUrl} alt={lookingAt} />
                {photos.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="workspace-hero-nav workspace-hero-nav--prev"
                      aria-label="Previous photo"
                      onClick={() => showPhoto(heroPos - 1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="workspace-hero-nav workspace-hero-nav--next"
                      aria-label="Next photo"
                      onClick={() => showPhoto(heroPos + 1)}
                    >
                      ›
                    </button>
                    <ol className="workspace-hero-dots">
                      {photos.map((url, index) => (
                        <li key={url}>
                          <button
                            type="button"
                            className={index === heroPos ? 'is-on' : undefined}
                            aria-label={`Photo ${index + 1}`}
                            onClick={() => showPhoto(index)}
                          />
                        </li>
                      ))}
                    </ol>
                  </>
                ) : null}
                <div className="workspace-hero-head">
                  <p className="home-price workspace-hero-price">
                    {formatPrice(property.priceCents)}
                    {property.isDemo ? <DemoTag /> : null}
                  </p>
                  {showAddress(property) ? (
                    <p className="home-address workspace-hero-address">{property.address}</p>
                  ) : null}
                  {facts.length > 0 ? (
                    <p className="workspace-specs workspace-hero-specs">
                      {facts.map((fact, index) => (
                        <span key={fact} className="workspace-spec">
                          {index > 0 ? <span className="workspace-spec-sep" aria-hidden="true">·</span> : null}
                          {fact}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
                <div className="workspace-hero-foot">
                  <RoomSwitcher
                    overlay
                    photos={photos}
                    labels={labels}
                    activeSlug={activeRoomSlug}
                    onPick={pickRoom}
                  />
                  <div className="workspace-hero-caption">
                    <span className="workspace-hero-caption-kicker">Looking at</span>
                    <strong>{lookingAt}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="workspace-meta">
              <TrueMonthlyCost
                compact
                purchasePrice={property.priceCents == null ? '' : property.priceCents / 100}
              />
              {has3d ? (
                <details className="workspace-drawer workspace-drawer--inline">
                  <summary className="workspace-drawer-summary workspace-drawer-summary--tight">
                    <span className="workspace-drawer-title">3D tour</span>
                    <span className="workspace-drawer-meta">Attached</span>
                  </summary>
                  <div className="workspace-drawer-body workspace-drawer-body--flush">
                    <CesiumViewer showcase={room.showcase} />
                  </div>
                </details>
              ) : (
                <CesiumViewer compact showcase={room.showcase} />
              )}
            </div>
          </div>
          {readiness ? (
            <WorkspaceReadinessPanel
              readiness={readiness}
              overrideScore={overrideScore}
              overrideReason={overrideReason}
              onScoreChange={setOverrideScore}
              onReasonChange={setOverrideReason}
              onSubmit={async (event) => {
                event.preventDefault();
                const score = Number(overrideScore);
                try {
                  const { data } = await api.post(
                    `/api/buyer/workspaces/${room.workspace.id}/readiness/override`,
                    { score, reason: overrideReason.trim() },
                  );
                  setReadiness(data.readiness);
                  setOverrideReason('');
                } catch {
                  setError('Readiness override needs a score 0–100 and a reason.');
                }
              }}
            />
          ) : null}
        </article>

        <section className="chat-panel workspace-chat" aria-label="Workspace chat">
          <header className="chat-top">
            <div className="chat-top-copy">
              <h2>Room chat</h2>
              <p className="muted chat-who">{who}</p>
            </div>
          </header>
          {showGuestConsent ? (
            <details className="chat-settings">
              <summary>Your name &amp; contact</summary>
              <div className="chat-settings-body">
                <label className="chat-name chat-name--block">
                  <span>Display name</span>
                  <input
                    maxLength={40}
                    placeholder="Guest"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="consent-switch consent-switch--compact">
                  <input
                    type="checkbox"
                    checked={consent}
                    disabled={savingConsent}
                    onChange={(event) => saveConsent(event.target.checked)}
                  />
                  <span className="consent-switch-ui" aria-hidden="true" />
                  <span className="consent-switch-copy">
                    <strong>Share contact on Premium</strong>
                    <span>Only when you turn this on and the realtor is on Premium.</span>
                  </span>
                </label>
              </div>
            </details>
          ) : (
            <label className="chat-name chat-name--bar">
              <span>Name</span>
              <input
                maxLength={40}
                placeholder="Guest"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          {error ? <p className="form-error chat-error" role="alert">{error}</p> : null}
          <ol className="chat-log" ref={logRef}>
            {messages.length === 0 ? (
              <li className="chat-empty">
                <p>Mention a room — the photo updates live.</p>
                <div className="chat-empty-rooms">
                  {[['kitchen', 'Kitchen'], ['living', 'Living room'], ['bedroom', 'Bedroom'], ['bathroom', 'Bathroom']].map(([slug, label]) => (
                    <button
                      key={slug}
                      type="button"
                      className="chat-room-chip"
                      onClick={() => {
                        insertMention(slug);
                        setFocusSlug(slug);
                      }}
                    >
                      @{label.toLowerCase()}
                    </button>
                  ))}
                </div>
              </li>
            ) : null}
            {messages.map((item) => (
              <li key={item.id} className={item.isYou ? 'chat-line chat-line--you' : 'chat-line'}>
                <span className="bubble-meta">
                  {item.isYou ? 'You' : item.authorName}
                  {messageTime(item.createdAt) ? ` · ${messageTime(item.createdAt)}` : ''}
                </span>
                <div className={item.isYou ? 'bubble bubble--you' : 'bubble'}>
                  <ChatBody text={item.body} onMention={setFocusSlug} />
                </div>
              </li>
            ))}
          </ol>
          <div className="chat-dock">
            {suggestions.length > 0 ? (
              <ul className="mention-list" aria-label="Rooms you can mention">
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
                placeholder="Message · @kitchen"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className="button" disabled={sending || !draft.trim()}>
                {sending ? '…' : 'Send'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </Page>
  );
}
