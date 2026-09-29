import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { usePageTitle } from '../../shared/usePageTitle.js';
import ListingImportForm from '../components/ListingImportForm.jsx';
import ViewDemo from '../components/ViewDemo.jsx';
import CardSwap, { Card } from '../../shared/visual/CardSwap.jsx';
import VantaClouds from '../../shared/visual/VantaClouds.jsx';

const ROOMS = [
  { id: 'kitchen', label: '@kitchen', line: 'Is the island big enough for two?' },
  { id: 'living', label: '@living', line: 'That window is the whole room.' },
  { id: 'yard', label: '@yard', line: 'Fence looks new. Ask about the slope.' },
];

const STEPS = [
  ['Paste', 'Drop a Zillow or Realtor link. Photos, price, and address land in a private workspace.'],
  ['Walk', 'Notes and pictures stay on the house. Type a room. That photo comes forward.'],
  ['Decide', 'True monthly cost, compare, and a short share link — when you want company.'],
];

function RoomStage() {
  const [room, setRoom] = useState(ROOMS[0]);

  return (
    <div className="lp-stage">
      <div className={`lp-photo lp-photo--${room.id}`} aria-hidden="true">
        <span className="lp-photo-tag">{room.label}</span>
      </div>
      <div className="lp-chat">
        <p className="lp-chat-kicker">Workspace chat</p>
        <div className="lp-bubble lp-bubble--them">Walked the house. Sending photos now.</div>
        <div className="lp-bubble">
          {ROOMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === room.id ? 'lp-mention is-on' : 'lp-mention'}
              onClick={() => setRoom(item)}
            >
              {item.label}
            </button>
          ))}
          <span> {room.line}</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  usePageTitle('Open House Tools');
  const navigate = useNavigate();
  const { properties, ready } = useGuestWorkspace();
  const savedCount = properties.length;

  return (
    <main className="lm-root landing-root">
      <section className="lm-hero landing-hero">
        <VantaClouds />
        <div className="lm-hero-inner">
          <div className="lm-hero-text">
            <span className="lm-eyebrow">Open House Tools</span>
            <h1 className="lm-h1">
              Walk the house.
              <br />
              Keep the <em className="lm-h1-em">picture</em>.
            </h1>
            <p className="lm-sub">
              One private place for photos, the real monthly number, and the conversation — starting from a listing link.
            </p>
            <ListingImportForm
              large
              onSaved={() => navigate('/collect')}
            />
            <div className="landing-hero-links">
              <ViewDemo className="lm-btn-outline" />
              <Link to="/learn-more" className="lm-btn-outline">How it works</Link>
              {ready && savedCount > 0 ? (
                <Link to="/collect">You have {savedCount} saved · open them</Link>
              ) : (
                <Link to="/realtor">I am a realtor</Link>
              )}
            </div>
          </div>
          <div className="lm-cards">
            <CardSwap>
              <Card title="Mention a room">
                <p>Type @kitchen in chat. The kitchen photo comes forward on this page — no extra tab.</p>
              </Card>
              <Card title="Open house album">
                <p>Walk the house. Notes and photos stay private until you send a short link.</p>
              </Card>
              <Card title="True monthly cost">
                <p>Mortgage, tax, utilities, and a reserve. Every line marked Estimate.</p>
              </Card>
            </CardSwap>
          </div>
        </div>
        <p className="lp-scroll" aria-hidden="true">Scroll</p>
      </section>

      <section className="lp-live">
        <div className="lp-live-copy">
          <span className="lm-eyebrow">Try it</span>
          <h2 className="lp-h2">Tap a room. Watch the photo move.</h2>
          <p className="lp-copy">
            This is the workspace idea: the chat and the house stay on the same screen. Mentions are links, not decorations.
          </p>
        </div>
        <RoomStage />
      </section>

      <section className="lm-grid-section lp-steps-band">
        <div className="lm-grid-header">
          <span className="lm-grid-eyebrow">Three moves</span>
          <h2 className="lm-grid-h2">From a link to a decision</h2>
        </div>
        <ol className="lp-steps">
          {STEPS.map(([title, body], index) => (
            <li key={title}>
              <span className="lp-step-n">{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lm-cta-band">
        <div className="lm-cta-band-inner">
          <span className="lm-cta-band-eyebrow">Guest first</span>
          <h2 className="lm-cta-band-h2">No account to start.</h2>
          <p className="lm-cta-band-sub">Login is how you keep the workspace later. Notes stay yours until you share.</p>
          <div className="lm-cta-band-btns">
            <Link to="/collect" className="lm-btn-dark">Start collecting</Link>
            <Link to="/learn-more" className="lm-btn-outline">Learn more</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
