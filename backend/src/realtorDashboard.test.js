import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'dash.sqlite');
process.env.CORS_ORIGIN = 'http://127.0.0.1:5173';

const access = await import('./services/dataAccess.js');
const { createApp } = await import('./server.js');
const { runWithActor } = await import('./middleware/rls.js');
const { WORKSPACE_EVENT_TYPE } = await import('./models/WorkspaceEvent.js');
const { assertNoContactFields } = await import('./services/realtorInsights.js');

access.migrate();

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

let sequence = 0;

function as(user, fn) {
  return runWithActor({ id: user.id, kind: user.kind }, fn);
}

function person(name) {
  sequence += 1;
  return access.provisionUser({
    email: `${name}-${sequence}@example.com`,
    displayName: name,
    phone: '555-0100',
  });
}

function seed() {
  const realtor = person('Kai');
  const buyer = person('Ada');
  const family = person('Bea');
  const property = as(realtor, () => access.createProperty({
    address: '88 Demo Street',
    photoUrls: ['https://photos.zillowstatic.com/fp/one.jpg'],
  }));
  const workspace = as(realtor, () => access.createWorkspace({
    propertyId: property.id,
    kind: 'primary',
  }));
  as(realtor, () => access.addWorkspaceMember(workspace.id, buyer.id, 'buyer'));
  as(realtor, () => access.addWorkspaceMember(workspace.id, family.id, 'family'));
  as(buyer, () => access.startOpenHouseVisit(property.id));
  as(buyer, () => access.addOpenHouseNote(
    as(buyer, () => access.listOpenHouseVisits())[0].id,
    'We must keep the kitchen island.',
  ));
  as(buyer, () => access.addOpenHousePhoto(
    as(buyer, () => access.listOpenHouseVisits())[0].id,
    PNG,
  ));
  as(realtor, () => access.setPhotoLabel(workspace.id, 'https://photos.zillowstatic.com/fp/one.jpg', 'kitchen'));
  as(buyer, () => access.postWorkspaceChat(workspace.id, 'The light in @kitchen is better. We need that window.'));
  as(family, () => access.postWorkspaceChat(workspace.id, '@kitchen works if the island stays.'));
  as(realtor, () => access.recordWorkspaceEvent({
    eventType: WORKSPACE_EVENT_TYPE.MODEL_3D_INTERACTION,
    workspaceId: workspace.id,
    propertyId: property.id,
  }));
  return { realtor, buyer, family, property, workspace };
}

test('free analytics omits pro, premium, questions, and contact fields', () => {
  const { realtor, workspace } = seed();
  as(realtor, () => access.setRealtorTier('free'));
  const pack = as(realtor, () => access.readRealtorAnalytics(workspace.id));
  assert.equal(pack.tier, 'free');
  assert.equal(typeof pack.free.visitCount, 'number');
  assert.equal(pack.pro, undefined);
  assert.equal(pack.questions, undefined);
  assert.equal(pack.openHouse, undefined);
  assert.equal(pack.online, undefined);
  assert.equal(pack.premium, undefined);
  assert.doesNotThrow(() => assertNoContactFields(pack));
});

test('pro analytics never includes name or contact even when the DB has them', () => {
  const { realtor, workspace } = seed();
  as(realtor, () => access.setRealtorTier('pro'));
  const pack = as(realtor, () => access.readRealtorAnalytics(workspace.id));
  assert.equal(pack.tier, 'pro');
  assert.ok(pack.pro.visits.length >= 1);
  assert.equal(pack.pro.visits[0].slotLabel.startsWith('Visitor'), true);
  assert.doesNotThrow(() => assertNoContactFields(pack));
  const json = JSON.stringify(pack);
  assert.equal(json.includes('Ada'), false);
  assert.equal(json.includes('555-0100'), false);
  assert.equal(json.includes('@example.com'), false);
});

test('premium analytics respects consent in both states', () => {
  const { realtor, buyer, workspace } = seed();
  as(realtor, () => access.setRealtorTier('premium'));
  const closed = as(realtor, () => access.readRealtorAnalytics(workspace.id));
  const identity = closed.pro.visits[0].identity;
  assert.equal(identity.disclosure, "Buyer hasn't agreed to share contact info");
  assert.equal(identity.displayName, undefined);
  assert.equal(identity.phone, undefined);

  as(buyer, () => access.setOwnMemberConsent(workspace.id, true));
  const open = as(realtor, () => access.readRealtorAnalytics(workspace.id));
  const shown = open.pro.visits[0].identity;
  assert.equal(shown.disclosure, undefined);
  assert.equal(shown.displayName, 'Ada');
  assert.equal(shown.phone, '555-0100');
});

test('five questions return cited answers from seeded activity', () => {
  const { realtor, workspace } = seed();
  as(realtor, () => access.setRealtorTier('pro'));
  const pack = as(realtor, () => access.readRealtorAnalytics(workspace.id));
  assert.match(pack.questions.decisionMaker.basis, /Based on/);
  assert.match(pack.questions.decisionMaker.answer, /Visitor/);
  assert.match(pack.questions.nonNegotiables.answer, /must|need/i);
  assert.match(pack.questions.nonNegotiables.basis, /Inferred/);
  assert.match(pack.questions.whoHasTheBall.basis, /last message/);
  assert.equal(pack.online.model3dInteractions, 1);
  assert.ok(pack.openHouse.photoCount >= 1);
  assert.ok(pack.openHouse.rooms.includes('kitchen'));
});

test('dashboard HTTP returns gated analytics for the current tier', async () => {
  const { realtor, workspace } = seed();
  as(realtor, () => access.setRealtorTier('free'));
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const guest = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    // The HTTP guest is a different actor — this only checks route shape for that guest.
    const empty = await fetch(`${base}/api/realtor/dashboard`, {
      headers: { 'x-guest-token': guest.token },
    }).then((res) => res.json());
    assert.equal(empty.tier, 'free');
    assert.ok(Array.isArray(empty.listings));

    const forbidden = await fetch(`${base}/api/realtor/workspaces/${workspace.id}/analytics`, {
      headers: { 'x-guest-token': guest.token },
    });
    assert.equal(forbidden.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
