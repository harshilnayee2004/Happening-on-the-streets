import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const srcRoot = path.dirname(fileURLToPath(import.meta.url));

function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) {
      files.push(full);
    }
  }
  return files;
}

test('only the data-access layer talks to the database', () => {
  const files = sourceFiles(srcRoot);
  for (const file of files) {
    const relative = path.relative(srcRoot, file).replaceAll('\\', '/');
    const source = readFileSync(file, 'utf8');
    if (source.includes('node:sqlite')) {
      assert.equal(relative, 'config/db.js');
    }
    if (source.includes("config/db.js") && relative !== 'config/db.js') {
      assert.equal(relative, 'services/dataAccess.js');
    }
    if (source.includes('.prepare(')) {
      assert.equal(relative, 'services/dataAccess.js');
    }
  }
});

test('listing fetch stays on the allow-list and guest claim sends nothing', () => {
  const listing = readFileSync(path.join(srcRoot, 'services/listingParser.js'), 'utf8');
  const guest = readFileSync(path.join(srcRoot, 'services/guestClaim.js'), 'utf8');
  assert.equal(listing.includes("redirect: 'manual'"), true);
  assert.equal(listing.includes("redirect: 'follow'"), false);
  assert.equal(listing.includes('twilio'), false);
  assert.equal(guest.includes('fetch('), false);
  assert.equal(guest.includes('http.request'), false);
  assert.equal(guest.includes('twilio'), false);
  assert.equal(guest.includes('axios'), false);
});
