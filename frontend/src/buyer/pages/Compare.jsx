import { useMemo, useState } from 'react';
import Page from '../../shared/components/Page.jsx';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { openHouseLinks } from '../../shared/nav.js';
import HomePhoto from '../components/HomePhoto.jsx';
import OpenChat from '../components/OpenChat.jsx';
import TrueMonthlyCost from '../components/TrueMonthlyCost.jsx';
import { formatPrice, homeFacts, showAddress } from '../format.js';

function pickId(properties, selected, other) {
  if (selected && properties.some((property) => property.id === selected)) return selected;
  return properties.find((property) => property.id !== other)?.id || '';
}

function HomeColumn({ property }) {
  if (!property) {
    return (
      <article className="home-card compare-card">
        <div className="home-body">
          <p className="muted">Choose a home to put here.</p>
        </div>
      </article>
    );
  }
  const title = property.title || property.address;
  const facts = homeFacts(property);
  return (
    <article className="home-card compare-card">
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
        </p>
      </div>
    </article>
  );
}

export default function Compare() {
  const { properties, ready } = useGuestWorkspace();
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  const left = useMemo(() => pickId(properties, leftId, rightId), [properties, leftId, rightId]);
  const right = useMemo(() => pickId(properties, rightId, left), [properties, rightId, left]);
  const leftHome = properties.find((property) => property.id === left);
  const rightHome = properties.find((property) => property.id === right);

  return (
    <Page
      eyebrow="Open House Tools"
      title="Compare"
      lede="Put two saved homes side by side. Price, monthly cost, and chat stay with each one."
      links={openHouseLinks}
      shellNote={false}
    >
      {!ready ? <p className="muted">Loading your homes…</p> : null}
      {ready && properties.length < 2 ? (
        <div className="empty">
          <p>Save at least two homes on Collect to compare them.</p>
        </div>
      ) : null}
      {properties.length >= 2 ? (
        <>
          <div className="compare-pickers">
            <label>
              First home
              <select value={left} onChange={(event) => setLeftId(event.target.value)}>
                {properties.map((property) => (
                  <option key={property.id} value={property.id} disabled={property.id === right}>
                    {property.title || property.address}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Second home
              <select value={right} onChange={(event) => setRightId(event.target.value)}>
                {properties.map((property) => (
                  <option key={property.id} value={property.id} disabled={property.id === left}>
                    {property.title || property.address}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="compare-grid">
            <HomeColumn property={leftHome} />
            <HomeColumn property={rightHome} />
          </div>
        </>
      ) : null}
    </Page>
  );
}
