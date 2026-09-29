import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { realtorLinks } from '../../shared/nav.js';
import HomePhoto from '../../buyer/components/HomePhoto.jsx';
import ShareHome from '../../buyer/components/ShareHome.jsx';
import { formatPrice } from '../../buyer/format.js';
import DashGlance from '../components/DashGlance.jsx';
import DemoTag from '../../buyer/components/DemoTag.jsx';

const TIERS = [
  ['free', 'Free'],
  ['pro', 'Pro'],
  ['premium', 'Premium'],
];

function Question({ title, item }) {
  if (!item) return null;
  return (
    <li className="insight-q">
      <h4>{title}</h4>
      <p>{item.answer}</p>
      <p className="muted">{item.basis}</p>
    </li>
  );
}

function Insights({ analytics }) {
  if (!analytics) return <p className="muted">Loading insight…</p>;
  const { tier, free } = analytics;
  return (
    <div className="insight-stack">
      <section className="insight-panel" aria-label="Free counts">
        <h3>Numbers</h3>
        <ul className="signal-row">
          <li><strong>{free.visitCount}</strong> visits</li>
          <li><strong>{free.inviteCount}</strong> invites</li>
          <li><strong>{free.durationTotalLabel}</strong></li>
          <li>{free.durationAverageLabel}</li>
        </ul>
      </section>
      {tier === 'free' ? null : (
        <>
          <section className="insight-panel" aria-label="Visits">
            <h3>{tier === 'premium' ? 'Visits with disclosure' : 'Anonymous visits'}</h3>
            {(analytics.pro?.visits || []).length === 0 ? (
              <p className="muted">No visit rows yet.</p>
            ) : (
              <ul className="visit-cards">
                {analytics.pro.visits.map((visit) => (
                  <li key={visit.visitId} className="visit-card">
                    <p className="visit-slot">{visit.slotLabel}</p>
                    <p>{visit.durationLabel} in the home</p>
                    <p>{visit.photoCount} photos · {visit.videoCount} videos</p>
                    <p>Rooms: {visit.rooms.length > 0 ? visit.rooms.join(', ') : 'none tagged'}</p>
                    <p className="muted">{visit.discussionBasis}</p>
                    {tier === 'premium' ? (
                      visit.identity?.disclosure ? (
                        <p className="consent-hold">{visit.identity.disclosure}</p>
                      ) : (
                        <dl className="consent-card">
                          <div><dt>Name</dt><dd>{visit.identity.displayName}</dd></div>
                          <div><dt>Email</dt><dd>{visit.identity.email}</dd></div>
                          <div><dt>Phone</dt><dd>{visit.identity.phone}</dd></div>
                          <div><dt>Profile</dt><dd>{visit.identity.profileBackground}</dd></div>
                        </dl>
                      )
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="insight-panel" aria-label="Five questions">
            <h3>Five questions</h3>
            <p className="muted">
              {analytics.questionsSource === 'ai'
                ? 'AI answers with the same citation pattern. Falls back to rules if the model call fails.'
                : 'Rules-based answers with citations. AI runs when an API key is configured.'}
            </p>
            <ol className="insight-qs">
              <Question title="Who is the decision maker?" item={analytics.questions?.decisionMaker} />
              <Question title="What has the network discussed?" item={analytics.questions?.networkDiscussion} />
              <Question title="What looks non-negotiable?" item={analytics.questions?.nonNegotiables} />
              <Question title="What is the main obstacle?" item={analytics.questions?.mainObstacle} />
              <Question title="Who has the ball?" item={analytics.questions?.whoHasTheBall} />
            </ol>
          </section>
          <section className="insight-panel" aria-label="Open house">
            <h3>Open house</h3>
            <ul className="signal-row">
              <li><strong>{analytics.openHouse?.photoCount ?? 0}</strong> photos</li>
              <li><strong>{analytics.openHouse?.videoCount ?? 0}</strong> videos</li>
              <li>{analytics.openHouse?.durationLabel} in the home</li>
            </ul>
            <p>Rooms entered: {(analytics.openHouse?.rooms || []).join(', ') || 'none tagged'}</p>
            {(analytics.openHouse?.notes || []).length > 0 ? (
              <ul className="note-list">
                {analytics.openHouse.notes.map((note, index) => (
                  <li key={`${note.createdAt}-${index}`}>{note.body}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No linked notes yet.</p>
            )}
          </section>
          <section className="insight-panel" aria-label="Online">
            <h3>Online</h3>
            <ul className="signal-row">
              <li><strong>{analytics.online?.model3dInteractions ?? 0}</strong> 3D model interactions</li>
              <li><strong>{analytics.online?.photoVideoEvents ?? 0}</strong> photo/video events</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [listings, setListings] = useState([]);
  const [tier, setTier] = useState('free');
  const [insights, setInsights] = useState({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [savingTier, setSavingTier] = useState(false);
  const [openCards, setOpenCards] = useState({});

  async function load() {
    await ensureGuest();
    const { data } = await api.get('/api/realtor/dashboard');
    setListings(data.listings);
    setTier(data.tier || 'free');
    const next = {};
    await Promise.all(data.listings.map(async (item) => {
      const pack = await api.get(`/api/realtor/workspaces/${item.workspace.id}/analytics`);
      next[item.workspace.id] = pack.data;
    }));
    setInsights(next);
  }

  useEffect(() => {
    let cancelled = false;
    load()
      .then(() => {
        if (!cancelled) setError('');
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

  async function changeTier(next) {
    setSavingTier(true);
    try {
      await ensureGuest();
      await api.put('/api/realtor/account', { tier: next });
      setTier(next);
      await load();
    } catch {
      setError('The plan could not be changed.');
    } finally {
      setSavingTier(false);
    }
  }

  return (
    <Page
      eyebrow="Realtor"
      title="Dashboard"
      lede="Switch the plan live. Free is counts only. Pro is anonymous detail. Premium adds contact the buyer agreed to share."
      links={realtorLinks}
      shellNote={false}
    >
      <div className="tier-switch" role="tablist" aria-label="Realtor plan">
        {TIERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tier === value}
            className={tier === value ? 'tier-tab is-on' : 'tier-tab'}
            disabled={savingTier}
            onClick={() => changeTier(value)}
          >
            {label}
          </button>
        ))}
      </div>
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
        const open = Boolean(openCards[item.workspace.id]);
        const analytics = insights[item.workspace.id];
        return (
          <article
            className={open ? 'home-card dash-card is-open' : 'home-card dash-card'}
            key={item.workspace.id}
          >
            <button
              type="button"
              className="dash-card-head"
              aria-expanded={open}
              onClick={() => setOpenCards((prev) => ({
                ...prev,
                [item.workspace.id]: !prev[item.workspace.id],
              }))}
            >
              <div className="dash-card-frame">
                <HomePhoto src={item.property.photoUrls?.[0]} alt="" />
              </div>
              <div className="dash-card-side">
                <DashGlance uid={item.workspace.id} free={analytics?.free} />
                <div className="dash-card-ident">
                  <p className="home-price">
                    {formatPrice(item.property.priceCents)}
                    {item.property.isDemo ? <DemoTag /> : null}
                  </p>
                  <h3>{title}</h3>
                  <span className="dash-card-toggle">
                    {open ? 'Collapse' : 'Expand'}
                    <span className="dash-card-chevron" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </button>
            <div className="dash-card-more" inert={!open || undefined}>
              <div className="dash-card-more-inner">
                <div className="home-body dash-card-body">
                  {tier === 'free' ? null : item.lastMessage ? (
                    <p className="last-message">Latest chat is on the workspace. Open it to reply.</p>
                  ) : (
                    <p className="muted">No buyer chat yet.</p>
                  )}
                  <p className="home-actions home-actions--row">
                    <Link className="button" to={`/workspace/${item.workspace.id}`}>Open workspace</Link>
                    <ShareHome propertyId={item.property.id} />
                  </p>
                  <form
                    className="showcase-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const modelUrl = String(form.get('modelUrl') || '').trim();
                      try {
                        await api.put(`/api/realtor/workspaces/${item.workspace.id}/showcase`, {
                          modelUrl: modelUrl || undefined,
                          latitude: item.property.latitude ?? undefined,
                          longitude: item.property.longitude ?? undefined,
                        });
                      } catch {
                        setError('Showcase URL could not be saved.');
                      }
                    }}
                  >
                    <label>
                      Matterport or Cesium tiles URL
                      <input name="modelUrl" type="url" placeholder="https://my.matterport.com/show/?m=…" />
                    </label>
                    <button type="submit" className="button button--quiet">Attach 3D</button>
                  </form>
                  <Insights analytics={analytics} />
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </Page>
  );
}
