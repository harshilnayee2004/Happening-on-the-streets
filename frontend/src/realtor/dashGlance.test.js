import assert from 'node:assert/strict';
import { test } from 'node:test';
import { glanceFromFree } from './dashGlance.js';

test('glance uses the same free visit, invite, and duration counts', () => {
  const glance = glanceFromFree({
    visitCount: 2,
    inviteCount: 4,
    durationSecondsTotal: 1800,
  });
  assert.equal(glance.visits, 2);
  assert.equal(glance.invites, 4);
  assert.equal(glance.minutes, 30);
  assert.ok(glance.pulse > 0 && glance.pulse <= 100);
});

test('missing analytics renders as empty glance values', () => {
  assert.deepEqual(glanceFromFree(undefined), {
    visits: 0,
    invites: 0,
    minutes: 0,
    pulse: 0,
  });
});
