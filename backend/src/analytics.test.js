import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'analytics.sqlite');
process.env.CORS_ORIGIN = 'http://127.0.0.1:5173,https://solid-fiesta.vercel.app';

const access = await import('./services/dataAccess.js');
const { runWithActor } = await import('./middleware/rls.js');
const { WORKSPACE_EVENT_TYPE } = await import('./models/WorkspaceEvent.js');
const { env } = await import('./config/env.js');

access.migrate();

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

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

function seedPrimary() {
  const realtor = person('Realtor');
  const buyer = person('Buyer');
  const property = as(realtor, () => access.createProperty({
    address: '123 Main Street',
    photoUrls: ['https://photos.zillowstatic.com/fp/kitchen.jpg'],
  }));
  const workspace = as(realtor, () => access.createWorkspace({
    propertyId: property.id,
    kind: 'primary',
  }));
  as(realtor, () => access.addWorkspaceMember(workspace.id, buyer.id, 'buyer'));
  return { realtor, buyer, property, workspace };
}

test('CORS_ORIGIN keeps local and the Vercel origin', () => {
  assert.deepEqual(env.corsOrigin, [
    'http://127.0.0.1:5173',
    'https://solid-fiesta.vercel.app',
  ]);
});

test('a new realtor account defaults to free', () => {
  const { realtor } = seedPrimary();
  const account = as(realtor, () => access.readRealtorAccount(realtor.id));
  assert.equal(account.tier, 'free');
  assert.equal(account.userId, realtor.id);
});

test('consent defaults to false on the buyer-realtor membership', () => {
  const { realtor, buyer, workspace } = seedPrimary();
  const consent = as(realtor, () => access.readMemberConsent(workspace.id, buyer.id));
  assert.equal(consent.consentGiven, false);
  assert.equal(consent.consentGivenAt, null);
});

test('consent can be flipped for tests without a UI', () => {
  const { realtor, buyer, workspace } = seedPrimary();
  const given = as(realtor, () => access.setBuyerRealtorConsent(workspace.id, buyer.id, true));
  assert.equal(given.consentGiven, true);
  assert.equal(typeof given.consentGivenAt, 'string');
  const again = as(realtor, () => access.readMemberConsent(workspace.id, buyer.id));
  assert.equal(again.consentGiven, true);
  const revoked = as(realtor, () => access.setBuyerRealtorConsent(workspace.id, buyer.id, false));
  assert.equal(revoked.consentGiven, false);
  assert.equal(revoked.consentGivenAt, null);
});

test('each event type writes to workspace_events', () => {
  const { realtor, buyer, property, workspace } = seedPrimary();
  const types = Object.values(WORKSPACE_EVENT_TYPE);
  for (const eventType of types) {
    as(buyer, () => access.recordWorkspaceEvent({
      eventType,
      workspaceId: workspace.id,
      propertyId: property.id,
      roomLabel: eventType === WORKSPACE_EVENT_TYPE.ROOM_ENTERED ? 'kitchen' : null,
    }));
  }
  const events = as(realtor, () => access.listWorkspaceEvents(workspace.id));
  assert.deepEqual(events.map((row) => row.eventType).sort(), [...types].sort());
  assert.equal(events.every((row) => row.workspaceId === workspace.id), true);
  assert.equal(events.every((row) => row.propertyId === property.id), true);
  assert.equal(events.every((row) => row.actorId === buyer.id), true);
  const room = events.find((row) => row.eventType === WORKSPACE_EVENT_TYPE.ROOM_ENTERED);
  assert.equal(room.roomLabel, 'kitchen');
});

test('visits, photos, chat, invites, and room labels also write the event log', () => {
  const { realtor, buyer, property, workspace } = seedPrimary();

  as(buyer, () => access.startOpenHouseVisit(property.id));
  as(buyer, () => access.addOpenHousePhoto(
    as(buyer, () => access.listOpenHouseVisits())[0].id,
    PNG,
  ));
  as(buyer, () => access.postWorkspaceChat(workspace.id, 'The kitchen is tight.'));
  as(realtor, () => access.setPhotoLabel(
    workspace.id,
    'https://photos.zillowstatic.com/fp/kitchen.jpg',
    'kitchen',
  ));

  const share = as(realtor, () => access.shareCollectedHome(property.id));
  const guest = access.provisionGuest();
  as(guest, () => access.joinWorkspaceByToken(share.token));

  const events = as(realtor, () => access.listWorkspaceEvents(workspace.id));
  const types = events.map((row) => row.eventType);
  assert.equal(types.includes(WORKSPACE_EVENT_TYPE.VISIT), true);
  assert.equal(types.includes(WORKSPACE_EVENT_TYPE.PHOTO_CAPTURED), true);
  assert.equal(types.includes(WORKSPACE_EVENT_TYPE.CHAT_MESSAGE), true);
  assert.equal(types.includes(WORKSPACE_EVENT_TYPE.ROOM_ENTERED), true);
  assert.equal(types.includes(WORKSPACE_EVENT_TYPE.INVITE), true);
});
