import assert from 'node:assert/strict';
import { test } from 'node:test';
import { googleCalendarUrl } from './scheduleVisit.js';

test('google calendar url uses the template scheme', () => {
  const url = googleCalendarUrl({
    title: 'Visit 12 Oak',
    address: '12 Oak St',
    start: new Date('2026-10-01T15:00:00.000Z'),
    minutes: 45,
  });
  assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?/);
  assert.match(url, /action=TEMPLATE/);
  assert.match(url, /Visit\+12\+Oak/);
  assert.match(url, /20261001T150000Z/);
});
