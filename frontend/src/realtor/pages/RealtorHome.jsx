import { Link } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { realtorLinks } from '../../shared/nav.js';

export default function RealtorHome() {
  return (
    <Page
      eyebrow="Realtor"
      title="Understand what buyers need"
      lede="Create a property workspace from a listing, share the link at the open house, and see who is talking about the home."
      links={realtorLinks}
      shellNote={false}
    >
      <ol className="how-steps realtor-steps">
        <li>
          <span className="step-number" aria-hidden="true">1</span>
          <div>
            <h3>Paste the listing</h3>
            <p>Import the address, price, and photos into a primary workspace.</p>
          </div>
        </li>
        <li>
          <span className="step-number" aria-hidden="true">2</span>
          <div>
            <h3>Share the link</h3>
            <p>Buyers open the home, look at photos, and chat. Their private notes stay private.</p>
          </div>
        </li>
        <li>
          <span className="step-number" aria-hidden="true">3</span>
          <div>
            <h3>Read the signals</h3>
            <p>The dashboard shows visitors, messages, and visits — not page-view theater.</p>
          </div>
        </li>
      </ol>
      <p className="home-actions home-actions--row">
        <Link className="button" to="/realtor/create">Create a workspace</Link>
        <Link className="button button--quiet" to="/realtor/dashboard">Open dashboard</Link>
      </p>
    </Page>
  );
}
