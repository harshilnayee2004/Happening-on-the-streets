import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
delete process.env.OPENAI_API_KEY;
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'phase3.sqlite');
process.env.CORS_ORIGIN = 'http://127.0.0.1:5173';

const access = await import('./services/dataAccess.js');
const { createApp } = await import('./server.js');
const { runWithActor } = await import('./middleware/rls.js');
const { enhanceFiveQuestions } = await import('./services/aiQuestions.js');

access.migrate();

let sequence = 0;

function as(user, fn) {
  return runWithActor({ id: user.id, kind: user.kind }, fn);
}

function person(name) {
  sequence += 1;
  return access.provisionUser({
    email: `${name}-${sequence}@example.com`,
    displayName: name,
  });
}

test('AI five-questions falls back to the rules answers when no key is set', async () => {
  const fallback = {
    decisionMaker: { answer: 'Visitor 1', basis: 'Based on 2 messages tagged #kitchen' },
    networkDiscussion: { answer: 'Kitchen light', basis: 'Based on 2 messages tagged #kitchen' },
    nonNegotiables: { answer: 'island', basis: 'Inferred from notes' },
    mainObstacle: { answer: 'none', basis: 'Based on 0 obstacle words' },
    whoHasTheBall: { answer: 'Visitor 1', basis: 'Based on last message' },
  };
  const next = await enhanceFiveQuestions(fallback, { messages: ['hi'] });
  assert.deepEqual(next, fallback);
});

test('readiness score is explainable and override stores an event', () => {
  const realtor = person('Kai');
  const buyer = person('Ada');
  const property = as(realtor, () => access.createProperty({
    address: '12 Readiness Lane',
    photoUrls: ['https://photos.zillowstatic.com/fp/kit.jpg'],
  }));
  const workspace = as(realtor, () => access.createWorkspace({
    propertyId: property.id,
    kind: 'primary',
  }));
  as(realtor, () => access.addWorkspaceMember(workspace.id, buyer.id, 'buyer'));
  as(buyer, () => access.startOpenHouseVisit(property.id));
  as(buyer, () => access.postWorkspaceChat(workspace.id, 'Looking at @kitchen'));
  as(realtor, () => access.setPhotoLabel(workspace.id, 'https://photos.zillowstatic.com/fp/kit.jpg', 'kitchen'));
  as(buyer, () => access.setOwnMemberConsent(workspace.id, true));

  const pack = as(buyer, () => access.readReadiness(workspace.id));
  assert.equal(pack.score, pack.computed);
  assert.ok(pack.score >= 0 && pack.score <= 100);
  assert.ok(pack.resolved.some((line) => /Based on/.test(line)));
  assert.ok(Array.isArray(pack.blocking));

  assert.throws(() => as(buyer, () => access.overrideReadiness(workspace.id, 90, '')), (err) => err.code === 'invalid_input');
  const over = as(buyer, () => access.overrideReadiness(workspace.id, 91, 'Already under contract'));
  assert.equal(over.score, 91);
  assert.equal(over.override.reason, 'Already under contract');
  const events = as(realtor, () => access.readRealtorAnalytics(workspace.id));
  assert.equal(events.workspaceId, workspace.id);
});

test('showcase upsert is Matterport-capable and hidden from outsiders', () => {
  const realtor = person('Host');
  const outsider = person('Out');
  const property = as(realtor, () => access.createProperty({ address: '1 Model Way' }));
  const workspace = as(realtor, () => access.createWorkspace({
    propertyId: property.id,
    kind: 'primary',
  }));
  const showcase = as(realtor, () => access.upsertShowcase(workspace.id, {
    modelUrl: 'https://my.matterport.com/show/?m=abc123',
    latitude: 30.2,
    longitude: -97.7,
  }));
  assert.match(showcase.modelUrl, /matterport/);
  assert.equal(as(realtor, () => access.readShowcaseOptional(workspace.id)).id, showcase.id);
  assert.throws(() => as(outsider, () => access.readShowcase(workspace.id)), (err) => err.code === 'not_found');
});

test('referral search hides contact and unlock is not implemented', () => {
  const a = person('Ann');
  const b = person('Ben');
  const sharedProp = as(a, () => access.createProperty({ address: '9 Network St' }));
  const shared = as(a, () => access.createWorkspace({ propertyId: sharedProp.id, kind: 'primary' }));
  as(a, () => access.addWorkspaceMember(shared.id, b.id, 'family'));
  as(a, () => access.createReferral({
    leadType: 'buyer',
    location: 'Austin TX',
    propertyType: 'house',
    budgetRange: '700k',
    timeline: '60 days',
    contactName: 'Secret',
    contactEmail: 'secret@example.com',
  }));
  as(b, () => access.createReferral({
    leadType: 'buyer',
    location: 'Austin downtown',
    propertyType: 'house',
    budgetRange: '650k',
    contactName: 'Hidden',
    contactPhone: '555-9999',
  }));

  const network = as(b, () => access.searchReferrals({ query: 'Austin', scope: 'network' }));
  assert.equal(network.results.length, 1);
  assert.equal(network.results[0].contactLocked, true);
  assert.equal(network.results[0].contactName, undefined);
  assert.equal(network.results[0].contactEmail, undefined);

  const mine = as(b, () => access.listReferrals())[0];
  const theirs = network.results[0];
  const explained = as(b, () => access.explainReferralMatch(mine.id, theirs.id));
  assert.ok(explained.score >= 0);
  assert.ok(explained.reasons.some((line) => /Based on/.test(line)));
  assert.equal(explained.candidate.contactEmail, undefined);

  assert.throws(() => access.unlockReferral(), (err) => {
    assert.equal(err.status, 501);
    assert.equal(err.code, 'payment_not_implemented');
    return true;
  });
});

test('a valid referral lead is saved and listed for that guest', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const guest = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const created = await fetch(`${base}/api/referral/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': guest.token },
      body: JSON.stringify({
        leadType: 'buyer',
        location: 'Austin TX',
        propertyType: 'house',
        budgetRange: '700k',
        timeline: '60 days',
        contactName: 'Pat',
        contactEmail: 'pat@example.com',
      }),
    });
    assert.equal(created.status, 201);
    const saved = await created.json();
    assert.equal(saved.referral.location, 'Austin TX');
    assert.equal(saved.referral.contactEmail, 'pat@example.com');
    const listed = await fetch(`${base}/api/referral/leads`, {
      headers: { 'x-guest-token': guest.token },
    }).then((res) => res.json());
    assert.equal(listed.referrals.some((row) => row.id === saved.referral.id), true);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('referral unlock HTTP stays 501', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const guest = await fetch(`${base}/api/auth/guest`, { method: 'POST' }).then((res) => res.json());
    const res = await fetch(`${base}/api/referral/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': guest.token },
      body: '{}',
    });
    assert.equal(res.status, 501);
    const body = await res.json();
    assert.equal(body.error, 'payment_not_implemented');
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
