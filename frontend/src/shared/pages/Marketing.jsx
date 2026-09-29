import { Link } from 'react-router-dom';
import { usePageTitle } from '../usePageTitle.js';
import { openHouseLinks, realtorLinks, referralLinks } from '../nav.js';
import VantaClouds from '../visual/VantaClouds.jsx';
import ViewDemo from '../../buyer/components/ViewDemo.jsx';

const PRODUCTS = [
  {
    to: '/tools',
    kicker: 'Buyers',
    title: 'Open House Tools',
    body: 'Collect a listing, walk it, chat by room, and compare — private until you share.',
    cta: 'Open tools',
  },
  {
    to: '/realtor',
    kicker: 'Agents',
    title: 'Realtor',
    body: 'Publish a workspace from a listing. Share the link at the door. Read real buyer signals.',
    cta: 'Open realtor',
  },
  {
    to: '/referral',
    kicker: 'Partners',
    title: 'Referral',
    body: 'Pass a lead you cannot serve. The path is short and named — no anonymous blast.',
    cta: 'Open referral',
  },
];

export default function Marketing() {
  usePageTitle('Home');

  return (
    <main className="lm-root mk-root">
      <section className="lm-hero mk-hero">
        <VantaClouds />
        <div className="mk-hero-inner">
          <span className="lm-eyebrow">Hapstr</span>
          <h1 className="lm-h1">
            Three products. One private workspace for a house.
          </h1>
          <p className="lm-sub mk-hero-sub">
            We help buyers keep the picture, agents read the room, and partners hand off a lead — without turning the home into a form.
          </p>
          <div className="mk-hero-actions">
            <Link to="/tools" className="lm-btn-dark">Start as a buyer</Link>
            <ViewDemo className="lm-btn-outline" />
            <Link to="/realtor" className="lm-btn-outline">I am a realtor</Link>
          </div>
        </div>
      </section>

      <section className="mk-products" aria-labelledby="mk-products-h">
        <div className="lm-grid-header">
          <span className="lm-grid-eyebrow">What we sell</span>
          <h2 className="lm-grid-h2" id="mk-products-h">Pick the door that fits</h2>
        </div>
        <div className="mk-product-grid">
          {PRODUCTS.map((item) => (
            <article className="mk-product" key={item.to}>
              <span className="mk-kicker">{item.kicker}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <Link to={item.to} className="mk-product-cta">{item.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-map" aria-labelledby="mk-map-h">
        <div className="mk-map-copy">
          <span className="lm-eyebrow">Every route</span>
          <h2 className="lp-h2" id="mk-map-h">Go straight to the page you need</h2>
          <p className="lp-copy">Nothing here is decorative. Each link is a live screen in Hapstr.</p>
        </div>
        <div className="mk-map-cols">
          <nav className="mk-col" aria-label="Open House Tools pages">
            <h3>Open House Tools</h3>
            <Link to="/tools">Product home</Link>
            <Link to="/learn-more">Learn more</Link>
            {openHouseLinks.map((link) => (
              <Link key={link.to} to={link.to}>{link.label}</Link>
            ))}
          </nav>
          <nav className="mk-col" aria-label="Realtor pages">
            <h3>Realtor</h3>
            <Link to="/realtor">Product home</Link>
            {realtorLinks.map((link) => (
              <Link key={link.to} to={link.to}>{link.label}</Link>
            ))}
          </nav>
          <nav className="mk-col" aria-label="Referral pages">
            <h3>Referral</h3>
            <Link to="/referral">Product home</Link>
            {referralLinks.map((link) => (
              <Link key={link.to} to={link.to}>{link.label}</Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="lm-cta-band">
        <div className="lm-cta-band-inner">
          <span className="lm-cta-band-eyebrow">Guest first</span>
          <h2 className="lm-cta-band-h2">No account to start.</h2>
          <p className="lm-cta-band-sub">Notes stay yours until you share. Login is how you keep the workspace later.</p>
          <div className="lm-cta-band-btns">
            <Link to="/tools" className="lm-btn-dark">Paste a listing</Link>
            <Link to="/learn-more" className="lm-btn-outline">How tools work</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
