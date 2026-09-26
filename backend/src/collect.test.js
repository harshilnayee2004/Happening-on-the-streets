import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'collect.sqlite');
process.env.CORS_ORIGIN = 'http://127.0.0.1:5173';

const { migrate } = await import('./services/dataAccess.js');
const { createApp } = await import('./server.js');
const { setListingFetchForTests } = await import('./services/listingParser.js');

migrate();

const FIXTURES = {
  'https://www.zillow.com/homedetails/123-main/1_zpid/': `<!doctype html><html><head>
<script type="application/ld+json">
{
  "name": "Sunny 123 Main Street",
  "address": { "streetAddress": "123 Main Street", "addressLocality": "Oakland", "addressRegion": "CA", "postalCode": "94611" },
  "geo": { "latitude": 37.8, "longitude": -122.2 },
  "numberOfBedrooms": 3,
  "numberOfBathroomsTotal": 2,
  "floorSize": { "value": 1450 },
  "image": ["https://photos.zillowstatic.com/a.jpg"],
  "offers": { "price": 899000 }
}
</script></head></html>`,
  'https://www.realtor.com/realestateandhomes-detail/9-Oak': `<!doctype html><html><head>
<script type="application/ld+json">
{
  "name": "9 Oak Avenue",
  "address": { "streetAddress": "9 Oak Avenue", "addressLocality": "Berkeley", "addressRegion": "CA", "postalCode": "94702" },
  "offers": { "price": 1200000 }
}
</script></head></html>`,
};

function installFetch() {
  setListingFetchForTests(async (input, init) => {
    assert.equal(init.redirect, 'manual');
    const html = FIXTURES[input];
    if (!html) return new Response('missing', { status: 404, headers: { 'content-type': 'text/html' } });
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  });
}

test('a guest import is stored for that guest only', async () => {
  installFetch();
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const guestA = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const guestB = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    assert.equal(guestA.actor.kind, 'guest');
    assert.notEqual(guestA.actor.id, guestB.actor.id);

    const unauthenticated = await fetch(`${base}/api/buyer/listings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.zillow.com/homedetails/123-main/1_zpid/' }),
    });
    assert.equal(unauthenticated.status, 401);

    const created = await fetch(`${base}/api/buyer/listings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': guestA.token },
      body: JSON.stringify({ url: 'https://www.zillow.com/homedetails/123-main/1_zpid/' }),
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.property.createdBy, guestA.actor.id);
    assert.equal(createdBody.property.address, '123 Main Street, Oakland, CA, 94611');
    assert.equal(createdBody.property.title, 'Sunny 123 Main Street');
    assert.equal(createdBody.property.priceCents, 89900000);
    assert.deepEqual(createdBody.property.photoUrls, ['https://photos.zillowstatic.com/a.jpg']);

    const listB = await fetch(`${base}/api/buyer/listings`, {
      headers: { 'x-guest-token': guestB.token },
    }).then((res) => res.json());
    assert.deepEqual(listB.properties, []);

    const second = await fetch(`${base}/api/buyer/listings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': guestA.token },
      body: JSON.stringify({ url: 'https://www.realtor.com/realestateandhomes-detail/9-Oak' }),
    });
    assert.equal(second.status, 201);

    const listA = await fetch(`${base}/api/buyer/listings`, {
      headers: { 'x-guest-token': guestA.token },
    }).then((res) => res.json());
    assert.equal(listA.properties.length, 2);
    assert.equal(listA.properties[0].address, '9 Oak Avenue, Berkeley, CA, 94702');
    assert.equal(listA.properties[1].address, '123 Main Street, Oakland, CA, 94611');
    assert.equal(listA.properties.every((property) => property.createdBy === guestA.actor.id), true);

    const listBAfter = await fetch(`${base}/api/buyer/listings`, {
      headers: { 'x-guest-token': guestB.token },
    }).then((res) => res.json());
    assert.deepEqual(listBAfter.properties, []);
  } finally {
    setListingFetchForTests(null);
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
