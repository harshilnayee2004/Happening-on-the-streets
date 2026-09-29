import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNonPublicIp } from './utils/urlPolicy.js';
import { LISTING_FETCH_POLICY, assertAllowedListingUrl, parseListing } from './services/listingParser.js';

test('listing fetches cannot follow redirects', () => {
  assert.equal(LISTING_FETCH_POLICY.followRedirects, false);
  assert.ok(LISTING_FETCH_POLICY.timeoutMs > 0);
  assert.ok(LISTING_FETCH_POLICY.maxBytes > 0);
});

test('allow-list accepts Zillow and Realtor.com https URLs', () => {
  const zillow = assertAllowedListingUrl('https://www.zillow.com/homedetails/123-main/1_zpid/');
  assert.equal(zillow.hostname, 'www.zillow.com');
  const realtor = assertAllowedListingUrl('https://www.realtor.com/realestateandhomes-detail/123-Main');
  assert.equal(realtor.hostname, 'www.realtor.com');
});

test('share tracking query is stripped before fetch', () => {
  const zillow = assertAllowedListingUrl(
    'https://www.zillow.com/homedetails/2617-Scorpio-Dr-Colorado-Springs-CO-80906/13669472_zpid/?utm_campaign=zillowwebmessage&utm_medium=referral&utm_source=txtshare',
  );
  assert.equal(zillow.search, '');
  assert.equal(
    zillow.href,
    'https://www.zillow.com/homedetails/2617-Scorpio-Dr-Colorado-Springs-CO-80906/13669472_zpid/',
  );
});

test('parser rejects hosts, schemes, credentials, ports, and private addresses before any fetch', () => {
  assert.throws(() => assertAllowedListingUrl('https://evil.example/list'), (err) => err.code === 'host_not_allowed');
  assert.throws(() => assertAllowedListingUrl('https://www.zillow.com.evil.example/list'), (err) => err.code === 'host_not_allowed');
  assert.throws(() => assertAllowedListingUrl('http://www.zillow.com/list'), (err) => err.code === 'invalid_url');
  assert.throws(() => assertAllowedListingUrl('https://user:pass@www.zillow.com/list'), (err) => err.code === 'invalid_url');
  assert.throws(() => assertAllowedListingUrl('https://www.zillow.com:444/list'), (err) => err.code === 'invalid_url');
  assert.throws(() => assertAllowedListingUrl('https://127.0.0.1/list'), (err) => err.code === 'invalid_url');
  assert.throws(() => assertAllowedListingUrl('https://169.254.169.254/latest'), (err) => err.code === 'invalid_url');
  assert.throws(() => assertAllowedListingUrl('https://localhost/list'), (err) => err.code === 'invalid_url');
  assert.throws(() => assertAllowedListingUrl('https://10.0.0.8/secret'), (err) => err.code === 'invalid_url');
});

const FIXTURE = `<!doctype html><html><head>
<meta property="og:image" content="https://photos.zillowstatic.com/og.jpg" />
<script type="application/ld+json">
{
  "@type": "SingleFamilyResidence",
  "name": "Sunny 123 Main Street",
  "address": {
    "streetAddress": "123 Main Street",
    "addressLocality": "Oakland",
    "addressRegion": "CA",
    "postalCode": "94611"
  },
  "geo": { "latitude": 37.8, "longitude": -122.2 },
  "numberOfBedrooms": 3,
  "numberOfBathroomsTotal": 2,
  "floorSize": { "value": 1450 },
  "image": ["https://photos.zillowstatic.com/a.jpg"],
  "offers": { "price": 899000, "priceCurrency": "USD" }
}
</script></head><body></body></html>`;

const LISTING_URL = 'https://www.zillow.com/homedetails/123-main/1_zpid/';

test('resolved private addresses are rejected', () => {
  assert.equal(isNonPublicIp('8.8.8.8'), false);
  assert.equal(isNonPublicIp('127.0.0.1'), true);
  assert.equal(isNonPublicIp('10.0.0.8'), true);
  assert.equal(isNonPublicIp('192.168.1.20'), true);
  assert.equal(isNonPublicIp('169.254.169.254'), true);
  assert.equal(isNonPublicIp('::1'), true);
});

test('parser rejects non-allow-listed domains before fetch', async () => {
  let calls = 0;
  await assert.rejects(
    () => parseListing('https://evil.example/house', {
      fetchImpl: async () => {
        calls += 1;
        return new Response('no', { status: 200 });
      },
    }),
    (err) => err.code === 'host_not_allowed',
  );
  assert.equal(calls, 0);
});

test('parser rejects redirects and does not follow them', async () => {
  let calls = 0;
  await assert.rejects(
    () => parseListing(LISTING_URL, {
      fetchImpl: async (_url, init) => {
        calls += 1;
        assert.equal(init.redirect, 'manual');
        return new Response(null, { status: 302, headers: { location: 'https://evil.example/phish' } });
      },
    }),
    (err) => err.code === 'redirect_not_allowed',
  );
  assert.equal(calls, 1);

  const followed = new Response(FIXTURE, { status: 200, headers: { 'content-type': 'text/html' } });
  Object.defineProperty(followed, 'redirected', { value: true });
  await assert.rejects(
    () => parseListing(LISTING_URL, { fetchImpl: async () => followed }),
    (err) => err.code === 'redirect_not_allowed',
  );
});

test('parser rejects oversized listing pages', async () => {
  const body = new Uint8Array(LISTING_FETCH_POLICY.maxBytes + 1);
  await assert.rejects(
    () => parseListing(LISTING_URL, {
      fetchImpl: async () => new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    }),
    (err) => err.code === 'response_too_large',
  );
});

test('parser reads the listing fields from the page', async () => {
  const listing = await parseListing(LISTING_URL, {
    fetchImpl: async () => new Response(FIXTURE, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }),
  });
  assert.equal(listing.address, '123 Main Street, Oakland, CA, 94611');
  assert.equal(listing.title, 'Sunny 123 Main Street');
  assert.equal(listing.priceCents, 89900000);
  assert.equal(listing.bedrooms, 3);
  assert.equal(listing.bathrooms, 2);
  assert.equal(listing.sqft, 1450);
  assert.equal(listing.latitude, 37.8);
  assert.equal(listing.longitude, -122.2);
  assert.deepEqual(listing.photos, [
    'https://photos.zillowstatic.com/a.jpg',
    'https://photos.zillowstatic.com/og.jpg',
  ]);
});

test('parser reads a price that sits on the parent of the address', async () => {
  const html = `<!doctype html><html><head><script type="application/ld+json">
  {"price":500000,"item":{"name":"Parent priced home","address":{"streetAddress":"9 Oak Avenue","addressLocality":"Berkeley","addressRegion":"CA","postalCode":"94702"}}}
  </script></head></html>`;
  const listing = await parseListing('https://www.realtor.com/realestateandhomes-detail/9-Oak', {
    fetchImpl: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
  });
  assert.equal(listing.priceCents, 50000000);
  assert.equal(listing.address, '9 Oak Avenue, Berkeley, CA, 94702');
});

test('parser turns a timeout into a listing error', async () => {
  await assert.rejects(
    () => parseListing(LISTING_URL, {
      fetchImpl: async () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
    }),
    (err) => err.code === 'listing_timeout',
  );
});
