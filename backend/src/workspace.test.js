import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'workspace.sqlite');
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

function installFetch() {
  setListingFetchForTests(async (_input, init) => {
    assert.equal(init.redirect, 'manual');
    return new Response(LISTING, { status: 200, headers: { 'content-type': 'text/html' } });
  });
}

test('a share link lets another guest join the home chat and keeps outsiders out', async () => {
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
    const host = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const family = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const stranger = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());

    const imported = await fetch(`${base}/api/buyer/listings`, {
      method: 'POST',
      headers: headers(host.token, true),
      body: JSON.stringify({ url: 'https://www.zillow.com/homedetails/123-main/1_zpid/' }),
    });
    assert.equal(imported.status, 201);
    const property = (await imported.json()).property;

    const unauthenticated = await fetch(`${base}/api/buyer/listings/${property.id}/share`, { method: 'POST' });
    assert.equal(unauthenticated.status, 401);

    const stolen = await fetch(`${base}/api/buyer/listings/${property.id}/share`, {
      method: 'POST',
      headers: headers(family.token),
    });
    assert.equal(stolen.status, 404);

    const shared = await fetch(`${base}/api/buyer/listings/${property.id}/share`, {
      method: 'POST',
      headers: headers(host.token),
    });
    assert.equal(shared.status, 201);
    const shareBody = await shared.json();
    assert.equal(typeof shareBody.token, 'string');
    assert.equal(shareBody.token.includes('.'), false);
    assert.equal(shareBody.workspace.propertyId, property.id);
    assert.equal(shareBody.property.title, 'Sunny 123 Main Street');

    const grants = await fetch(`${base}/api/buyer/workspaces/${shareBody.workspace.id}`, {
      headers: headers(host.token),
    }).then((res) => res.json());
    assert.equal(grants.workspace.id, shareBody.workspace.id);
    assert.equal(JSON.stringify(grants).includes(shareBody.token), false);

    const badJoin = await fetch(`${base}/api/buyer/workspaces/join`, {
      method: 'POST',
      headers: headers(family.token, true),
      body: JSON.stringify({ token: 'not-a-real-share-token-value' }),
    });
    assert.equal(badJoin.status, 404);

    const joined = await fetch(`${base}/api/buyer/workspaces/join`, {
      method: 'POST',
      headers: headers(family.token, true),
      body: JSON.stringify({ token: shareBody.token }),
    });
    assert.equal(joined.status, 200);
    const room = await joined.json();
    assert.equal(room.property.id, property.id);
    assert.equal(room.members.some((member) => member.isYou), true);
    assert.equal(room.members.length >= 2, true);
    assert.deepEqual(room.photoLabels, []);

    const labeled = await fetch(`${base}/api/buyer/workspaces/${room.workspace.id}/photo-labels`, {
      method: 'POST',
      headers: headers(host.token, true),
      body: JSON.stringify({ photoUrl: 'https://photos.zillowstatic.com/a.jpg', room: 'kitchen' }),
    });
    assert.equal(labeled.status, 200);
    const labelBody = await labeled.json();
    assert.equal(labelBody.photoLabels[0].room, 'kitchen');
    assert.equal(labelBody.photoLabels[0].photoUrl, 'https://photos.zillowstatic.com/a.jpg');

    const familyRoom = await fetch(`${base}/api/buyer/workspaces/${room.workspace.id}`, {
      headers: headers(family.token),
    }).then((res) => res.json());
    assert.equal(familyRoom.photoLabels[0].room, 'kitchen');

    const named = await fetch(`${base}/api/buyer/profile`, {
      method: 'POST',
      headers: headers(family.token, true),
      body: JSON.stringify({ displayName: 'Sam' }),
    });
    assert.equal(named.status, 200);

    const posted = await fetch(`${base}/api/buyer/workspaces/${room.workspace.id}/messages`, {
      method: 'POST',
      headers: headers(family.token, true),
      body: JSON.stringify({ body: 'The kitchen light is better in person.' }),
    });
    assert.equal(posted.status, 201);
    const familyMessages = (await posted.json()).messages;
    assert.equal(familyMessages[0].body, 'The kitchen light is better in person.');
    assert.equal(familyMessages[0].authorName, 'Sam');
    assert.equal(familyMessages[0].isYou, true);

    const hostChat = await fetch(`${base}/api/buyer/workspaces/${room.workspace.id}/messages`, {
      headers: headers(host.token),
    }).then((res) => res.json());
    assert.equal(hostChat.messages[0].body, 'The kitchen light is better in person.');
    assert.equal(hostChat.messages[0].isYou, false);

    const strangerRoom = await fetch(`${base}/api/buyer/workspaces/${room.workspace.id}`, {
      headers: headers(stranger.token),
    });
    assert.equal(strangerRoom.status, 404);

    const strangerChat = await fetch(`${base}/api/buyer/workspaces/${room.workspace.id}/messages`, {
      method: 'POST',
      headers: headers(stranger.token, true),
      body: JSON.stringify({ body: 'I should not be here.' }),
    });
    assert.equal(strangerChat.status, 404);

    const strangerList = await fetch(`${base}/api/buyer/workspaces`, {
      headers: headers(stranger.token),
    }).then((res) => res.json());
    assert.deepEqual(strangerList.rooms, []);

    const familyList = await fetch(`${base}/api/buyer/workspaces`, {
      headers: headers(family.token),
    }).then((res) => res.json());
    assert.equal(familyList.rooms.length, 1);
    assert.equal(familyList.rooms[0].property.id, property.id);
    assert.equal(familyList.rooms[0].lastMessage.body, 'The kitchen light is better in person.');
    assert.equal(familyList.rooms[0].lastMessage.authorName, 'Sam');
    assert.equal(familyList.rooms[0].lastMessage.isYou, true);
  } finally {
    setListingFetchForTests(null);
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
