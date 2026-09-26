import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'hapstr-')), 'rls.sqlite');

const access = await import('./services/dataAccess.js');
const { rlsMiddleware, runWithActor } = await import('./middleware/rls.js');

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

function seed() {
  const realtor = person('Realtor');
  const buyer = person('Buyer');
  const family = person('Family');
  const outsider = person('Outsider');
  const property = as(realtor, () => access.createProperty({ address: '123 Main Street' }));
  const primary = as(realtor, () => access.createWorkspace({ propertyId: property.id, kind: 'primary' }));
  as(realtor, () => access.addWorkspaceMember(primary.id, buyer.id, 'buyer'));
  const collaboration = as(buyer, () => access.createWorkspace({
    propertyId: property.id,
    kind: 'collaboration',
    parentWorkspaceId: primary.id,
  }));
  return { realtor, buyer, family, outsider, property, primary, collaboration };
}

test('share links are hashes, and showcases have no public token column', () => {
  const schema = access.securitySchema();
  assert.equal(schema.workspaceItems.includes('visibility'), true);
  assert.equal(schema.showcases.includes('share_token'), false);
  assert.equal(schema.showcases.includes('token'), false);
  assert.equal(schema.accessGrants.includes('token_hash'), true);
  assert.equal(schema.accessGrants.includes('token'), false);
  assert.equal(schema.accessGrants.includes('share_token'), false);
});

test('a user can read only their own profile', () => {
  const a = person('Ada');
  const b = person('Bea');
  assert.equal(as(a, () => access.readUser(a.id)).email, a.email);
  assert.throws(() => as(a, () => access.readUser(b.id)), (err) => err.code === 'not_found');
  assert.throws(() => access.listWorkspaces(), (err) => err.code === 'unauthenticated');
});

test('queries require the request actor bound by rls middleware', () => {
  const user = person('Middleware');
  const req = { actor: { id: user.id, kind: user.kind } };
  let seen = false;
  rlsMiddleware(req, {}, () => {
    seen = true;
    assert.ok(Array.isArray(access.listWorkspaces()));
  });
  assert.equal(seen, true);
});

test('private buyer notes stay hidden from a realtor who shares the workspace', () => {
  const { realtor, buyer, family, outsider, collaboration } = seed();
  const note = as(buyer, () => access.createWorkspaceItem({
    workspaceId: collaboration.id,
    kind: 'note',
    body: 'I am worried about the roof.',
  }));
  assert.equal(note.visibility, 'private');

  assert.throws(
    () => as(realtor, () => access.listWorkspaceItems(collaboration.id)),
    (err) => err.code === 'not_found',
  );
  as(buyer, () => access.addWorkspaceMember(collaboration.id, realtor.id, 'realtor'));
  as(buyer, () => access.addWorkspaceMember(collaboration.id, family.id, 'family'));
  assert.deepEqual(as(realtor, () => access.listWorkspaceItems(collaboration.id)), []);
  assert.deepEqual(as(family, () => access.listWorkspaceItems(collaboration.id)), []);
  assert.equal(as(buyer, () => access.listWorkspaceItems(collaboration.id)).length, 1);

  as(buyer, () => access.setWorkspaceItemVisibility(note.id, 'realtor', []));
  assert.equal(as(realtor, () => access.listWorkspaceItems(collaboration.id))[0].id, note.id);
  assert.deepEqual(as(family, () => access.listWorkspaceItems(collaboration.id)), []);

  as(buyer, () => access.setWorkspaceItemVisibility(note.id, 'family', []));
  assert.equal(as(family, () => access.listWorkspaceItems(collaboration.id))[0].id, note.id);
  assert.deepEqual(as(realtor, () => access.listWorkspaceItems(collaboration.id)), []);

  as(buyer, () => access.setWorkspaceItemVisibility(note.id, 'shared', [family.id]));
  assert.equal(as(family, () => access.listWorkspaceItems(collaboration.id))[0].id, note.id);
  assert.deepEqual(as(realtor, () => access.listWorkspaceItems(collaboration.id)), []);

  as(buyer, () => access.setWorkspaceItemVisibility(note.id, 'everyone', []));
  assert.equal(as(realtor, () => access.listWorkspaceItems(collaboration.id))[0].id, note.id);
  assert.equal(as(family, () => access.listWorkspaceItems(collaboration.id))[0].id, note.id);
  assert.throws(
    () => as(outsider, () => access.listWorkspaceItems(collaboration.id)),
    (err) => err.code === 'not_found',
  );

  as(buyer, () => access.setWorkspaceItemVisibility(note.id, 'private', []));
  assert.deepEqual(as(realtor, () => access.listWorkspaceItems(collaboration.id)), []);
  assert.deepEqual(as(family, () => access.listWorkspaceItems(collaboration.id)), []);
});

test('membership does not let someone edit another person\'s visibility', () => {
  const { realtor, buyer, primary } = seed();
  const note = as(realtor, () => access.createWorkspaceItem({
    workspaceId: primary.id,
    kind: 'note',
    body: 'Seller renovated the kitchen in 2024.',
  }));
  assert.deepEqual(as(buyer, () => access.listWorkspaceItems(primary.id)), []);
  assert.throws(
    () => as(buyer, () => access.setWorkspaceItemVisibility(note.id, 'everyone', [])),
    (err) => err.code === 'not_found',
  );
  assert.throws(
    () => as(buyer, () => access.addWorkspaceMember(primary.id, realtor.id, 'realtor')),
    (err) => err.code === 'not_found',
  );
});

test('referral contacts and open-house albums stay with their creator', () => {
  const { realtor, buyer, collaboration } = seed();
  const referral = as(buyer, () => access.createReferral({
    leadType: 'buyer',
    location: 'California',
    contactName: 'Buyer',
    contactEmail: 'buyer-private@example.com',
    contactPhone: '555-0100',
  }));
  assert.equal(as(buyer, () => access.readReferral(referral.id)).contactEmail, 'buyer-private@example.com');
  assert.deepEqual(as(realtor, () => access.listReferrals()), []);
  assert.throws(() => as(realtor, () => access.readReferral(referral.id)), (err) => err.code === 'not_found');

  const album = as(buyer, () => access.createOpenHouseAlbum({
    workspaceId: collaboration.id,
    title: 'Saturday tour',
  }));
  as(buyer, () => access.addWorkspaceMember(collaboration.id, realtor.id, 'realtor'));
  assert.equal(as(buyer, () => access.listOpenHouseAlbums(collaboration.id))[0].id, album.id);
  assert.deepEqual(as(realtor, () => access.listOpenHouseAlbums(collaboration.id)), []);
  assert.throws(() => as(realtor, () => access.readOpenHouseAlbum(album.id)), (err) => err.code === 'not_found');
});

test('showcase placement is limited to workspace members and stores no share token', () => {
  const { realtor, outsider, primary } = seed();
  const showcase = as(realtor, () => access.createShowcase({
    workspaceId: primary.id,
    latitude: 37.7,
    longitude: -122.4,
    rotation: 10,
    scale: 1,
  }));
  assert.equal(showcase.workspaceId, primary.id);
  assert.equal(Object.hasOwn(showcase, 'shareToken'), false);
  assert.throws(() => as(outsider, () => access.readShowcase(primary.id)), (err) => err.code === 'not_found');
  assert.throws(
    () => as(realtor, () => access.createProperty({ address: '9 Oak', listingUrl: 'https://evil.example/home' })),
    (err) => err.code === 'host_not_allowed',
  );
});
