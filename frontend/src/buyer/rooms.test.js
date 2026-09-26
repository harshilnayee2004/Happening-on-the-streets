import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mentionDraft, parseMentions, photoForRoom } from './rooms.js';

test('chat text turns @room into a mention', () => {
  const parts = parseMentions('Look at @room then the @kitchen.');
  assert.deepEqual(parts.map((part) => part.type), ['text', 'mention', 'text', 'mention', 'text']);
  assert.equal(parts[1].value, 'room');
  assert.equal(parts[3].value, 'kitchen');
});

test('unknown at-words stay plain text', () => {
  const parts = parseMentions('email me @not-a-room');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].type, 'text');
});

test('a tagged kitchen photo is preferred over the first listing shot', () => {
  const photos = ['https://photos.example/house.jpg', 'https://photos.example/kitchen.jpg'];
  assert.equal(photoForRoom(photos, [], 'room'), photos[1]);
  assert.equal(
    photoForRoom(photos, [{ room: 'kitchen', photoUrl: photos[1] }], 'kitchen'),
    photos[1],
  );
});

test('mention draft reads the word after the last @', () => {
  assert.equal(mentionDraft('see @kit'), 'kit');
  assert.equal(mentionDraft('plain text'), '');
});
