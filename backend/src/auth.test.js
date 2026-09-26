import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
process.env.DATABASE_PATH = ':memory:';

const { authMiddleware, safeAppPath, signActorToken, verifyActorToken } = await import('./middleware/auth.js');

function runAuth(headers) {
  const req = {
    headers,
    get(name) {
      return this.headers[name.toLowerCase()];
    },
  };
  let error;
  authMiddleware(req, {}, (err) => {
    error = err;
  });
  return { req, error };
}

test('signed tokens keep only id and kind', () => {
  const token = signActorToken({ id: 'user-1', kind: 'user' });
  assert.deepEqual(verifyActorToken(token), { id: 'user-1', kind: 'user' });
});

test('extra privilege claims in a token are ignored', () => {
  const payload = {
    sub: 'user-1',
    kind: 'user',
    exp: Math.floor(Date.now() / 1000) + 60,
    admin: true,
    role: 'realtor',
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.AUTH_SECRET).update(body).digest('base64url');
  assert.deepEqual(verifyActorToken(`${body}.${sig}`), { id: 'user-1', kind: 'user' });
});

test('expired, tampered, and unknown-kind tokens are rejected', () => {
  assert.throws(
    () => verifyActorToken(signActorToken({ id: 'user-1', kind: 'user', expiresInSeconds: -10 })),
    (err) => err.code === 'invalid_token',
  );
  const token = signActorToken({ id: 'user-1', kind: 'user' });
  const [body, sig] = token.split('.');
  const flipped = sig.endsWith('a') ? `${sig.slice(0, -1)}b` : `${sig.slice(0, -1)}a`;
  assert.throws(() => verifyActorToken(`${body}.${flipped}`), (err) => err.code === 'invalid_token');

  const payload = { sub: 'user-1', kind: 'admin', exp: Math.floor(Date.now() / 1000) + 60 };
  const adminBody = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const adminSig = crypto.createHmac('sha256', process.env.AUTH_SECRET).update(adminBody).digest('base64url');
  assert.throws(() => verifyActorToken(`${adminBody}.${adminSig}`), (err) => err.code === 'invalid_token');
});

test('redirect paths stay inside the app', () => {
  assert.equal(safeAppPath('/workspace/abc'), '/workspace/abc');
  assert.equal(safeAppPath('/w/invite-token'), '/w/invite-token');
  assert.equal(safeAppPath('//evil.example'), null);
  assert.equal(safeAppPath('/\\evil.example'), null);
  assert.equal(safeAppPath('https://evil.example'), null);
  assert.equal(safeAppPath('\\evil.example'), null);
});

test('auth middleware distinguishes anonymous, user, and guest credentials', () => {
  assert.equal(runAuth({}).req.actor, null);
  assert.equal(runAuth({}).error, undefined);

  const userToken = signActorToken({ id: 'user-1', kind: 'user' });
  const userResult = runAuth({ authorization: `Bearer ${userToken}` });
  assert.deepEqual(userResult.req.actor, { id: 'user-1', kind: 'user' });

  const bad = runAuth({ authorization: 'Bearer not-a-token' });
  assert.equal(bad.error.code, 'invalid_token');

  const guestToken = signActorToken({ id: 'guest-1', kind: 'guest' });
  const guestResult = runAuth({ 'x-guest-token': guestToken });
  assert.deepEqual(guestResult.req.actor, { id: 'guest-1', kind: 'guest' });

  const userAsGuest = runAuth({ 'x-guest-token': userToken });
  assert.equal(userAsGuest.error.code, 'invalid_token');

  const both = runAuth({ authorization: `Bearer ${userToken}`, 'x-guest-token': guestToken });
  assert.equal(both.error.code, 'invalid_token');
});
