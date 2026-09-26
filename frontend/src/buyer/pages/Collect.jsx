import { Link } from 'react-router-dom';
import Page from '../../shared/components/Page.jsx';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { openHouseLinks } from '../../shared/nav.js';
import HomePhoto from '../components/HomePhoto.jsx';
import OpenChat from '../components/OpenChat.jsx';
import ShareHome from '../components/ShareHome.jsx';
import ListingImportForm from '../components/ListingImportForm.jsx';
import TrueMonthlyCost from '../components/TrueMonthlyCost.jsx';
import { formatPrice, homeFacts, showAddress } from '../format.js';

function HomeCard({ property }) {
  const facts = homeFacts(property);
  const title = property.title || property.address;
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
        <TrueMonthlyCost
          purchasePrice={property.priceCents == null ? '' : property.priceCents / 100}
        />
        <p className="home-actions home-actions--row">
          <OpenChat propertyId={property.id} />
          <ShareHome propertyId={property.id} />
          <Link to="/open-house">Start an open-house album</Link>
        </p>
      </div>
    </article>
  );
}

export default function Collect() {
  const { properties, ready, loadError } = useGuestWorkspace();

  return (
    <Page
      eyebrow="Open House Tools"
      title="Collect"
      lede="Every home you save lands here with its real monthly cost. Only you can see this list."
      links={openHouseLinks}
      shellNote={false}
    >
      <ListingImportForm buttonLabel="Add home" />

      <section className="saved" aria-label="Saved homes">
        <div className="section-head">
          <h2>Your homes</h2>
          {ready && properties.length > 0 ? (
            <p className="count">{properties.length} saved</p>
          ) : null}
        </div>
        {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}
        {!ready && !loadError && properties.length === 0 ? <p className="muted">Loading your homes…</p> : null}
        {ready && properties.length === 0 ? (
          <div className="empty">
            <p>Nothing here yet.</p>
            <p className="muted">Paste a listing link above and it will appear with its monthly cost.</p>
          </div>
        ) : null}
        {properties.map((property) => <HomeCard key={property.id} property={property} />)}
      </section>
    </Page>
  );
}
