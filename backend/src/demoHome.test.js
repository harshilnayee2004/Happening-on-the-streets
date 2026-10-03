import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'demo.sqlite');
process.env.CORS_ORIGIN = 'http://127.0.0.1:5173';

const { DEMO_PROPERTY_ID, migrate, seedDemoHome, demoShareToken } = await import('./services/dataAccess.js');
const { createApp } = await import('./server.js');
const { getDb } = await import('./config/db.js');

migrate();

test('seeding the demo home twice does not duplicate it', () => {
  const first = seedDemoHome();
  const second = seedDemoHome();
  assert.equal(first.propertyId, DEMO_PROPERTY_ID);
  assert.equal(second.propertyId, DEMO_PROPERTY_ID);
  const count = getDb().prepare('SELECT COUNT(*) AS total FROM properties WHERE is_demo = 1').get();
  assert.equal(Number(count.total), 1);
  const labels = getDb().prepare(`
    SELECT COUNT(*) AS total FROM workspace_items WHERE kind = 'photo_label' AND workspace_id = ?
  `).get(first.workspaceId);
  assert.equal(Number(labels.total), 5);
});

test('any guest can open the demo invite and see tagged room photos', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const guest = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const demo = await fetch(`${base}/api/buyer/demo`, {
      headers: { 'x-guest-token': guest.token },
    }).then((res) => res.json());
    assert.equal(demo.property.isDemo, true);
    assert.equal(demo.property.title.includes('Demo Home'), true);
    assert.equal(demo.token, demoShareToken());
    assert.equal(demo.property.photoUrls.length, 5);

    const joined = await fetch(`${base}/api/buyer/workspaces/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': guest.token },
      body: JSON.stringify({ token: demo.token }),
    }).then((res) => res.json());
    assert.equal(joined.property.isDemo, true);
    const kitchen = joined.photoLabels.find((item) => item.room === 'kitchen');
    assert.ok(kitchen);
    assert.equal(joined.property.photoUrls.includes(kitchen.photoUrl), true);

    const stranger = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const opened = await fetch(`${base}/api/buyer/workspaces/ws_hapstr_demo_home`, {
      headers: { 'x-guest-token': stranger.token },
    });
    assert.equal(opened.status, 200);
    const openedBody = await opened.json();
    assert.equal(openedBody.property.isDemo, true);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('concurrent opens of the demo workspace do not 500', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const guest = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const headers = { 'x-guest-token': guest.token };
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        fetch(`${base}/api/buyer/workspaces/ws_hapstr_demo_home`, { headers }),
      ),
    );
    for (const res of results) {
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
