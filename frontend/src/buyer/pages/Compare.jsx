import { useEffect, useMemo, useRef, useState } from 'react';
import Page from '../../shared/components/Page.jsx';
import { useGuestWorkspace } from '../../shared/guestWorkspace.jsx';
import { openHouseLinks } from '../../shared/nav.js';
import HomePhoto from '../components/HomePhoto.jsx';
import OpenChat from '../components/OpenChat.jsx';
import TrueMonthlyCost from '../components/TrueMonthlyCost.jsx';
import { cityLine, formatDollars, formatPrice, homeFacts, showAddress, streetNick } from '../format.js';
import { ROOM_OPTIONS, roomLabel } from '../rooms.js';
import { betterSide, pricePerSqftDollars } from '../compareTable.js';
import { estimateForPriceCents } from '../trueMonthlyCost.js';
import DemoTag from '../components/DemoTag.jsx';

function pickId(properties, selected, other) {
  if (selected && properties.some((property) => property.id === selected)) return selected;
  return properties.find((property) => property.id !== other)?.id || '';
}

function labelsFor(rooms, propertyId) {
  return rooms.find((room) => room.property.id === propertyId)?.photoLabels || [];
}

function photoForSlug(property, labels, slug) {
  const hit = labels.find((item) => item.room === slug);
  if (hit) return hit.photoUrl;
  return '';
}

function homeName(property) {
  if (!property) return 'This home';
  return property.title || property.address || 'This home';
}

function HomeRow({ property }) {
  const place = cityLine(property);
  return (
    <>
      <span className="compare-id-thumb">
        <HomePhoto src={property?.photoUrls?.[0]} alt="" />
      </span>
      <span className="compare-picker-meta">
        <strong>{streetNick(property)}{property?.isDemo ? ' · DEMO' : ''}</strong>
        {place ? <span>{place}</span> : null}
        <span className="compare-picker-price">{formatPrice(property?.priceCents)}</span>
      </span>
    </>
  );
}

function HomePicker({ name, value, otherId, properties, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = properties.find((property) => property.id === value);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={open ? 'compare-picker is-open' : 'compare-picker'} ref={rootRef}>
      <button
        type="button"
        className="compare-picker-shell"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={name}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="compare-picker-face">
          <HomeRow property={selected} />
          <span className="compare-picker-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open ? (
        <ul className="compare-picker-menu" role="listbox" aria-label={name}>
          {properties.map((property) => {
            const taken = property.id === otherId;
            const on = property.id === value;
            return (
              <li key={property.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={taken}
                  className={on ? 'compare-picker-option is-on' : 'compare-picker-option'}
                  onClick={() => {
                    onChange(property.id);
                    setOpen(false);
                  }}
                >
                  <HomeRow property={property} />
                  {taken ? <span className="compare-picker-taken">In the other column</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
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
      <div className="compare-hero">
        <div className="compare-hero-frame">
          <HomePhoto src={property.photoUrls?.[0]} alt={title} />
        </div>
      </div>
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

function RoomCell({ property, url, slug }) {
  const name = streetNick(property);
  return (
    <div className="compare-room-cell">
      <p className="compare-room-home">{name}</p>
      {url ? (
        <div className="compare-hero-frame compare-hero-frame--room">
          <HomePhoto src={url} alt={`${roomLabel(slug)} at ${name}`} />
        </div>
      ) : (
        <p className="muted compare-room-empty">No tagged photo</p>
      )}
    </div>
  );
}

function available(value, format) {
  if (value == null || value === '') return 'Not available';
  return format ? format(value) : String(value);
}

function compareRows(leftHome, rightHome) {
  const leftMonthly = estimateForPriceCents(leftHome?.priceCents);
  const rightMonthly = estimateForPriceCents(rightHome?.priceCents);
  const leftPpsf = pricePerSqftDollars(leftHome?.priceCents, leftHome?.sqft);
  const rightPpsf = pricePerSqftDollars(rightHome?.priceCents, rightHome?.sqft);
  const costLines = leftMonthly?.lines || rightMonthly?.lines || [];
  return {
    overview: [
      {
        label: 'Price',
        left: available(leftHome?.priceCents, formatPrice),
        right: available(rightHome?.priceCents, formatPrice),
        win: betterSide(leftHome?.priceCents, rightHome?.priceCents, 'lower'),
      },
      {
        label: 'Monthly cost',
        left: leftMonthly ? formatDollars(leftMonthly.total) : 'Not available',
        right: rightMonthly ? formatDollars(rightMonthly.total) : 'Not available',
        win: betterSide(leftMonthly?.total, rightMonthly?.total, 'lower'),
        note: 'Estimate',
      },
      {
        label: 'Price per sq ft',
        left: leftPpsf == null ? 'Not available' : formatDollars(leftPpsf),
        right: rightPpsf == null ? 'Not available' : formatDollars(rightPpsf),
        win: betterSide(leftPpsf, rightPpsf, 'lower'),
      },
      {
        label: 'Bedrooms',
        left: available(leftHome?.beds),
        right: available(rightHome?.beds),
        win: betterSide(leftHome?.beds, rightHome?.beds, 'higher'),
      },
      {
        label: 'Bathrooms',
        left: available(leftHome?.baths),
        right: available(rightHome?.baths),
        win: betterSide(leftHome?.baths, rightHome?.baths, 'higher'),
      },
      {
        label: 'Square footage',
        left: available(leftHome?.sqft, (n) => `${n.toLocaleString('en-US')} sq ft`),
        right: available(rightHome?.sqft, (n) => `${n.toLocaleString('en-US')} sq ft`),
        win: betterSide(leftHome?.sqft, rightHome?.sqft, 'higher'),
      },
      {
        label: 'Lot size',
        left: 'Not available',
        right: 'Not available',
        win: null,
      },
      {
        label: 'Address',
        left: leftHome?.address || 'Not available',
        right: rightHome?.address || 'Not available',
        win: null,
      },
    ],
    monthly: costLines.map((line) => {
      const leftVal = leftMonthly?.lines.find((item) => item.id === line.id)?.monthly;
      const rightVal = rightMonthly?.lines.find((item) => item.id === line.id)?.monthly;
      return {
        label: line.label,
        left: leftVal == null ? 'Not available' : formatDollars(leftVal),
        right: rightVal == null ? 'Not available' : formatDollars(rightVal),
        win: betterSide(leftVal, rightVal, 'lower'),
        note: 'Estimate',
      };
    }),
  };
}

function CompareValue({ value, win }) {
  return (
    <p className={win ? 'compare-val compare-val--win' : 'compare-val'}>
      {win ? <span className="compare-cue" aria-label="Better on this row">●</span> : null}
      <span>{value}</span>
    </p>
  );
}

function CompareIdentity({ property }) {
  if (!property) {
    return <p className="muted">Choose a home</p>;
  }
  return (
    <div className="compare-id">
      <div className="compare-id-thumb">
        <HomePhoto src={property.photoUrls?.[0]} alt="" />
      </div>
      <div className="compare-id-copy">
        <p className="compare-id-nick">
          {streetNick(property)}
          {property.isDemo ? <DemoTag /> : null}
        </p>
        <p className="compare-id-price">{formatPrice(property.priceCents)}</p>
        <p className="compare-id-addr">{property.address || homeName(property)}</p>
      </div>
    </div>
  );
}

function CompareFacts({ groups, side }) {
  return groups.map((group) => (
    <div className="compare-group" key={group.title}>
      <h3>{group.title}</h3>
      <dl>
        {group.rows.map((row) => (
          <div className="compare-fact" key={row.label}>
            <dt>
              {row.label}
              {row.note ? <span className="muted"> · {row.note}</span> : null}
            </dt>
            <dd>
              <CompareValue value={row[side]} win={row.win === side} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  ));
}

function ComparisonTable({ leftHome, rightHome }) {
  const { overview, monthly } = compareRows(leftHome, rightHome);
  const groups = [
    { title: 'Overview', rows: overview },
    { title: 'Monthly cost', rows: monthly },
  ];

  return (
    <section className="compare-board" aria-label="Side by side">
      <h2>Side by side</h2>
      <p className="muted">Lot size is not parsed from listings, so it stays Not available. Bathrooms show only when the listing page included them.</p>

      <div className="compare-board-desktop">
        <div className="compare-board-head">
          <div className="compare-board-label" aria-hidden="true" />
          <CompareIdentity property={leftHome} />
          <CompareIdentity property={rightHome} />
        </div>
        {groups.map((group) => (
          <div className="compare-group compare-group--split" key={group.title}>
            <h3>{group.title}</h3>
            {group.rows.map((row) => (
              <div className="compare-board-row" key={row.label}>
                <p className="compare-board-label">
                  {row.label}
                  {row.note ? <span className="muted"> · {row.note}</span> : null}
                </p>
                <CompareValue value={row.left} win={row.win === 'left'} />
                <CompareValue value={row.right} win={row.win === 'right'} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="compare-board-phone">
        <article className="compare-stack">
          <CompareIdentity property={leftHome} />
          <CompareFacts groups={groups} side="left" />
        </article>
        <article className="compare-stack">
          <CompareIdentity property={rightHome} />
          <CompareFacts groups={groups} side="right" />
        </article>
      </div>
    </section>
  );
}

function RoomRow({ slug, leftHome, rightHome, rooms }) {
  const left = leftHome ? photoForSlug(leftHome, labelsFor(rooms, leftHome.id), slug) : '';
  const right = rightHome ? photoForSlug(rightHome, labelsFor(rooms, rightHome.id), slug) : '';
  if (!left && !right) return null;
  return (
    <li className="compare-room">
      <h3>{roomLabel(slug)}</h3>
      <div className="compare-room-grid">
        <RoomCell property={leftHome} url={left} slug={slug} />
        <RoomCell property={rightHome} url={right} slug={slug} />
      </div>
    </li>
  );
}

export default function Compare() {
  const { properties, rooms, ready } = useGuestWorkspace();
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  const left = useMemo(() => pickId(properties, leftId, rightId), [properties, leftId, rightId]);
  const right = useMemo(() => pickId(properties, rightId, left), [properties, rightId, left]);
  const leftHome = properties.find((property) => property.id === left);
  const rightHome = properties.find((property) => property.id === right);
  const leftMonthly = estimateForPriceCents(leftHome?.priceCents);
  const rightMonthly = estimateForPriceCents(rightHome?.priceCents);
  const delta = leftMonthly && rightMonthly
    ? Math.round((rightMonthly.total - leftMonthly.total) * 100) / 100
    : null;

  return (
    <Page
      eyebrow="Open House Tools"
      title="Compare"
      lede="Two saved homes, room by room. Monthly cost sits on the same default assumptions as Collect."
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
            <HomePicker
              name="Home on the left"
              value={left}
              otherId={right}
              properties={properties}
              onChange={setLeftId}
            />
            <p className="compare-pickers-vs" aria-hidden="true">vs</p>
            <HomePicker
              name="Home on the right"
              value={right}
              otherId={left}
              properties={properties}
              onChange={setRightId}
            />
          </div>
          {delta != null ? (
            <p className={delta === 0 ? 'compare-delta' : 'compare-delta compare-delta--on'} role="status">
              Monthly cost delta (estimate): {delta > 0 ? '+' : ''}
              ${Math.abs(delta).toLocaleString('en-US')}
              {delta === 0
                ? ' — same estimate'
                : delta > 0
                  ? ` more for ${streetNick(rightHome)}`
                  : ` less for ${streetNick(rightHome)}`}
            </p>
          ) : null}
          <div className="compare-grid">
            <HomeColumn property={leftHome} />
            <HomeColumn property={rightHome} />
          </div>
          <ComparisonTable leftHome={leftHome} rightHome={rightHome} />
          <section className="compare-rooms" aria-label="Room-by-room photos">
            <h2>Rooms</h2>
            <p className="muted">Uses @room photo labels from each workspace. A room appears only if at least one home tagged it.</p>
            <ul className="compare-room-list">
              {ROOM_OPTIONS.map(([slug]) => (
                <RoomRow
                  key={slug}
                  slug={slug}
                  leftHome={leftHome}
                  rightHome={rightHome}
                  rooms={rooms}
                />
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </Page>
  );
}
