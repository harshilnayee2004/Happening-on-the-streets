import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'open-house.sqlite');
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
  "offers": { "price": 899000 }
}
</script></head></html>`;

function installFetch() {
  setListingFetchForTests(async (_input, init) => {
    assert.equal(init.redirect, 'manual');
    return new Response(LISTING, { status: 200, headers: { 'content-type': 'text/html' } });
  });
}

test('a guest visit album stays with that guest', async () => {
  installFetch();
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = (token, json = false) => ({
    ...(json ? { 'content-type': 'application/json' } : {}),
    'x-guest-token': token,
  });
  try {
    const guestA = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const guestB = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());

    const unauthenticated = await fetch(`${base}/api/buyer/visits`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId: 'missing' }),
    });
    assert.equal(unauthenticated.status, 401);

    const imported = await fetch(`${base}/api/buyer/listings`, {
      method: 'POST',
      headers: headers(guestA.token, true),
      body: JSON.stringify({ url: 'https://www.zillow.com/homedetails/123-main/1_zpid/' }),
    });
    assert.equal(imported.status, 201);
    const propertyId = (await imported.json()).property.id;

    const started = await fetch(`${base}/api/buyer/visits`, {
      method: 'POST',
      headers: headers(guestA.token, true),
      body: JSON.stringify({ propertyId }),
    });
    assert.equal(started.status, 201);
    const visit = (await started.json()).visit;
    assert.equal(visit.propertyId, propertyId);
    assert.equal(visit.createdBy, guestA.actor.id);
    assert.deepEqual(visit.notes, []);
    assert.deepEqual(visit.photos, []);

    const again = await fetch(`${base}/api/buyer/visits`, {
      method: 'POST',
      headers: headers(guestA.token, true),
      body: JSON.stringify({ propertyId }),
    });
    assert.equal(again.status, 200);
    assert.equal((await again.json()).visit.id, visit.id);

    const otherProperty = await fetch(`${base}/api/buyer/visits`, {
      method: 'POST',
      headers: headers(guestB.token, true),
      body: JSON.stringify({ propertyId }),
    });
    assert.equal(otherProperty.status, 404);

    const noted = await fetch(`${base}/api/buyer/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: headers(guestA.token, true),
      body: JSON.stringify({ body: 'Kitchen faces the garden.' }),
    });
    assert.equal(noted.status, 201);
    assert.equal((await noted.json()).visit.notes[0].body, 'Kitchen faces the garden.');

    const emptyNote = await fetch(`${base}/api/buyer/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: headers(guestA.token, true),
      body: JSON.stringify({ body: '   ' }),
    });
    assert.equal(emptyNote.status, 400);

    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
      0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    const photo = await fetch(`${base}/api/buyer/visits/${visit.id}/photos`, {
      method: 'POST',
      headers: { ...headers(guestA.token), 'content-type': 'image/jpeg' },
      body: jpeg,
    });
    assert.equal(photo.status, 201);
    const savedPhoto = (await photo.json()).visit.photos[0];
    assert.equal(savedPhoto.contentType, 'image/jpeg');
    assert.equal(Object.hasOwn(savedPhoto, 'url'), false);

    const downloaded = await fetch(`${base}/api/buyer/visits/${visit.id}/photos/${savedPhoto.id}`, {
      headers: headers(guestA.token),
    });
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), jpeg);

    const linked = await fetch(`${base}/api/buyer/visits/${visit.id}/photos`, {
      method: 'POST',
      headers: headers(guestA.token, true),
      body: JSON.stringify({ url: 'https://photos.example/kitchen.jpg' }),
    });
    assert.equal(linked.status, 415);

    const fake = await fetch(`${base}/api/buyer/visits/${visit.id}/photos`, {
      method: 'POST',
      headers: { ...headers(guestA.token), 'content-type': 'image/jpeg' },
      body: Buffer.from('not a photo'),
    });
    assert.equal(fake.status, 400);

    const stolenPhoto = await fetch(`${base}/api/buyer/visits/${visit.id}/photos/${savedPhoto.id}`, {
      headers: headers(guestB.token),
    });
    assert.equal(stolenPhoto.status, 404);

    const stolenNote = await fetch(`${base}/api/buyer/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: headers(guestB.token, true),
      body: JSON.stringify({ body: 'I should not see this.' }),
    });
    assert.equal(stolenNote.status, 404);

    const listB = await fetch(`${base}/api/buyer/visits`, {
      headers: headers(guestB.token),
    }).then((res) => res.json());
    assert.deepEqual(listB.visits, []);

    const listA = await fetch(`${base}/api/buyer/visits`, {
      headers: headers(guestA.token),
    }).then((res) => res.json());
    assert.equal(listA.visits.length, 1);
    assert.equal(listA.visits[0].createdBy, guestA.actor.id);
    assert.equal(listA.visits[0].notes.length, 1);
    assert.equal(listA.visits[0].photos.length, 1);
    assert.equal(listA.visits[0].notes[0].body, 'Kitchen faces the garden.');
  } finally {
    setListingFetchForTests(null);
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
