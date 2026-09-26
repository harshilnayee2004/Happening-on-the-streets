import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'realtor.sqlite');
process.env.CORS_ORIGIN = 'http://127.0.0.1:5173';

const { migrate } = await import('./services/dataAccess.js');
const { createApp } = await import('./server.js');
const { setListingFetchForTests } = await import('./services/listingParser.js');

migrate();

const LISTING = `<!doctype html><html><head>
<script type="application/ld+json">
{
  "name": "Sunny 123 Main Street",
  "address": { "streetAddress": "123 Main Street", "addressLocality": "Oakland", "addressRegion": "CA", "postalCode": "94611" },
  "image": ["https://photos.zillowstatic.com/a.jpg"],
  "offers": { "price": 899000 }
}
</script></head></html>`;

test('a realtor can publish a workspace and only they see it on the dashboard', async () => {
  setListingFetchForTests(async (_input, init) => {
    assert.equal(init.redirect, 'manual');
    return new Response(LISTING, { status: 200, headers: { 'content-type': 'text/html' } });
  });
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const realtor = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const other = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());

    const created = await fetch(`${base}/api/realtor/workspaces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': realtor.token },
      body: JSON.stringify({ url: 'https://www.zillow.com/homedetails/123-main/1_zpid/' }),
    });
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.property.title, 'Sunny 123 Main Street');
    assert.equal(typeof body.token, 'string');
    assert.equal(body.workspace.propertyId, body.property.id);

    const dash = await fetch(`${base}/api/realtor/dashboard`, {
      headers: { 'x-guest-token': realtor.token },
    }).then((res) => res.json());
    assert.equal(dash.listings.length, 1);
    assert.equal(dash.listings[0].workspace.id, body.workspace.id);
    assert.equal(dash.listings[0].visitors, 0);
    assert.equal(dash.listings[0].messages, 0);

    const otherDash = await fetch(`${base}/api/realtor/dashboard`, {
      headers: { 'x-guest-token': other.token },
    }).then((res) => res.json());
    assert.deepEqual(otherDash.listings, []);

    const joined = await fetch(`${base}/api/buyer/workspaces/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': other.token },
      body: JSON.stringify({ token: body.token }),
    });
    assert.equal(joined.status, 200);

    const afterJoin = await fetch(`${base}/api/realtor/dashboard`, {
      headers: { 'x-guest-token': realtor.token },
    }).then((res) => res.json());
    assert.equal(afterJoin.listings[0].visitors, 1);
  } finally {
    setListingFetchForTests(null);
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
