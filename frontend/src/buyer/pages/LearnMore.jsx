import { Link } from 'react-router-dom';
import { usePageTitle } from '../../shared/usePageTitle.js';
import CardSwap, { Card } from '../../shared/visual/CardSwap.jsx';
import VantaClouds from '../../shared/visual/VantaClouds.jsx';

const FEATURES = [
  ['Collect', 'Save a listing and see what the home may really cost each month.'],
  ['Open House', 'Capture notes and photos in a private album while you walk.'],
  ['Workspace', 'Talk about rooms. Type @kitchen and the photo comes up.'],
  ['Compare', 'Put two homes side by side when it is time to decide.'],
  ['Share', 'Send a short link. Family joins without an account.'],
  ['Private first', 'Notes stay yours until you choose to share them.'],
  ['Realtor', 'Publish a workspace, share the link, read buyer signals.'],
  ['3D next', 'Cesium and Matterport plug into the same workspace.'],
];

export default function LearnMore() {
  usePageTitle('Learn more');

  return (
    <main className="lm-root">
      <Link to="/tools" className="lm-back">← Back to tools</Link>

      <section className="lm-hero">
        <VantaClouds />
        <div className="lm-hero-inner">
          <div className="lm-hero-text">
            <span className="lm-eyebrow">Open House Tools</span>
            <h1 className="lm-h1">
              Understand the home as an{' '}
              <em className="lm-h1-em">interactive</em>
              {' '}workspace.
            </h1>
            <p className="lm-sub">
              Click the cards. Then paste a listing and keep the whole picture in one place.
            </p>
            <Link to="/collect" className="lm-cta-primary">Start collecting</Link>
          </div>
          <div className="lm-cards">
            <CardSwap>
              <Card title="3D exploration">
                <p>Look at the house, then click a room mention in chat to bring that photo forward.</p>
              </Card>
              <Card title="Live open house">
                <p>Walk the home, keep photos private, and share only what you mean to share.</p>
              </Card>
              <Card title="True monthly cost">
                <p>Mortgage, tax, insurance, utilities, and a reserve — labeled as estimates.</p>
              </Card>
            </CardSwap>
          </div>
        </div>
      </section>

      <div className="lm-rule" />

      <section className="lm-grid-section">
        <div className="lm-grid-header">
          <span className="lm-grid-eyebrow">What you can do</span>
          <h2 className="lm-grid-h2">The workspace, not a bookmark</h2>
          <p className="lm-grid-sub">Collect, visit, discuss, and decide — with permissions on every item.</p>
        </div>
        <div className="lm-grid">
          {FEATURES.map(([label, desc]) => (
            <div className="lm-grid-card" key={label}>
              <p className="lm-card-label">{label}</p>
              <p className="lm-card-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lm-cta-band">
        <div className="lm-cta-band-inner">
          <span className="lm-cta-band-eyebrow">Ready to look?</span>
          <h2 className="lm-cta-band-h2">Paste a listing. Keep the picture.</h2>
          <p className="lm-cta-band-sub">No account to start. Login is how you keep it later.</p>
          <div className="lm-cta-band-btns">
            <Link to="/tools" className="lm-btn-dark">Get started</Link>
            <Link to="/realtor" className="lm-btn-outline">I am a realtor</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
