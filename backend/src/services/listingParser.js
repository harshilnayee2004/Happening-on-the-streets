import { lookup } from 'node:dns/promises';
import { HttpError } from '../utils/httpError.js';
import { assertHttpsUrl, isBlockedAddress, isNonPublicIp } from '../utils/urlPolicy.js';

export const LISTING_FETCH_POLICY = Object.freeze({
  allowedHosts: Object.freeze([
    'zillow.com',
    'www.zillow.com',
    'realtor.com',
    'www.realtor.com',
  ]),
  followRedirects: false,
  timeoutMs: 8000,
  maxBytes: 1_500_000,
});

const ALLOWED_HOSTS = new Set(LISTING_FETCH_POLICY.allowedHosts);
const MAX_PHOTOS = 12;
let testFetch = null;

export function setListingFetchForTests(fetchImpl) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Listing fetch overrides are only available in tests');
  }
  testFetch = fetchImpl ?? null;
}

export function assertAllowedListingUrl(raw) {
  const url = assertHttpsUrl(raw);
  if (isBlockedAddress(url.hostname)) throw new HttpError(400, 'blocked_address');
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new HttpError(400, 'host_not_allowed');
  return url;
}

async function assertHostnameResolvesPublic(hostname) {
  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new HttpError(422, 'listing_unavailable');
  }
  if (!records?.length) throw new HttpError(422, 'listing_unavailable');
  for (const record of records) {
    if (isNonPublicIp(record.address)) throw new HttpError(400, 'blocked_address');
  }
}

async function readLimitedBody(response) {
  const declared = response.headers.get('content-length');
  if (declared != null && Number(declared) > LISTING_FETCH_POLICY.maxBytes) {
    throw new HttpError(422, 'response_too_large');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > LISTING_FETCH_POLICY.maxBytes) {
      await reader.cancel();
      throw new HttpError(422, 'response_too_large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readAddress(node) {
  if (!node || typeof node !== 'object') return null;
  const address = node.address && typeof node.address === 'object' ? node.address : node;
  const street = address.streetAddress || node.streetAddress;
  if (typeof street !== 'string' || street.trim().length === 0) return null;
  const city = address.addressLocality || address.city || node.city || '';
  const region = address.addressRegion || address.state || node.state || '';
  const postal = address.postalCode || address.zipcode || node.zipcode || '';
  const locality = [city, region].filter((part) => typeof part === 'string' && part.trim()).join(', ');
  return [street.trim(), locality, String(postal).trim()].filter(Boolean).join(', ');
}

function readPriceDollars(node) {
  const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  return asNumber(offers?.price ?? node.price ?? node.unformattedPrice ?? node.listPrice);
}

function readBeds(node) {
  return asNumber(node.bedrooms ?? node.beds ?? node.numberOfBedrooms);
}

function readBaths(node) {
  return asNumber(node.bathrooms ?? node.baths ?? node.numberOfBathroomsTotal ?? node.numberOfBathrooms);
}

function readSqft(node) {
  const raw = asNumber(node.livingArea ?? node.livingAreaValue ?? node.sqft ?? node.floorSize?.value ?? node.floorSize);
  if (raw == null) return null;
  return Math.round(raw);
}

function readCoords(node) {
  const lat = asNumber(node.latitude ?? node.lat ?? node.geo?.latitude);
  const lng = asNumber(node.longitude ?? node.lng ?? node.long ?? node.geo?.longitude);
  if (lat == null || lng == null) return { latitude: null, longitude: null };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { latitude: null, longitude: null };
  return { latitude: lat, longitude: lng };
}

function pushPhoto(value, out, depth) {
  if (depth > 5 || out.length >= MAX_PHOTOS || value == null) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) pushPhoto(item, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    pushPhoto(value.url ?? value.contentUrl ?? value.href, out, depth + 1);
  }
}

function readPhotos(node) {
  const found = [];
  pushPhoto(node.image, found, 0);
  pushPhoto(node.images, found, 0);
  pushPhoto(node.photo, found, 0);
  pushPhoto(node.photos, found, 0);
  return found;
}

function scoreNode(node) {
  let score = 0;
  if (readAddress(node)) score += 1;
  if (readPriceDollars(node) != null) score += 4;
  if (readBeds(node) != null) score += 1;
  if (readCoords(node).latitude != null) score += 1;
  return score;
}

function visit(value, state, found, parent) {
  if (state.left <= 0 || value == null || typeof value !== 'object') return;
  state.left -= 1;
  if (Array.isArray(value)) {
    for (const item of value) visit(item, state, found, parent);
    return;
  }
  if (readAddress(value)) found.push({ node: value, parent: parent ?? null });
  for (const key of Object.keys(value)) {
    if (state.left <= 0) return;
    visit(value[key], state, found, value);
  }
}

function firstValue(node, parent, read) {
  const direct = node ? read(node) : null;
  if (direct != null) return direct;
  return parent ? read(parent) : null;
}

function metaContent(html, key) {
  const pattern = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${key}["'][^>]*>`, 'gi');
  const contents = [];
  for (const tag of html.match(pattern) ?? []) {
    const match = /\bcontent=["']([^"']*)["']/i.exec(tag);
    if (match) contents.push(decodeHtml(match[1]));
  }
  return contents;
}

function absoluteHttps(raw, pageUrl) {
  try {
    const absolute = new URL(raw, pageUrl).href;
    return assertHttpsUrl(absolute).href;
  } catch {
    return null;
  }
}

export function extractListing(html, pageUrl) {
  if (typeof html !== 'string' || html.trim().length === 0) {
    throw new HttpError(422, 'parse_failed');
  }
  const found = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    const interesting = /application\/ld\+json/i.test(attrs)
      || /application\/json/i.test(attrs)
      || /\bid=["']__NEXT_DATA__["']/i.test(attrs);
    if (!interesting) continue;
    try {
      visit(JSON.parse(body), { left: 20000 }, found, null);
    } catch {
      continue;
    }
  }
  const best = found
    .map((entry) => ({
      ...entry,
      score: scoreNode(entry.node) + (entry.parent && readPriceDollars(entry.parent) != null ? 4 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0] ?? null;
  const node = best?.node ?? null;
  const parent = best?.parent ?? null;
  const address = node ? readAddress(node) : null;
  if (!address) throw new HttpError(422, 'parse_failed');
  const dollars = firstValue(node, parent, readPriceDollars);
  const ogTitle = metaContent(html, 'og:title')[0] ?? null;
  const named = typeof node?.name === 'string' && node.name.trim()
    ? node.name.trim()
    : (typeof parent?.name === 'string' && parent.name.trim() ? parent.name.trim() : null);
  const titleSource = named || ogTitle;
  const photos = [];
  for (const raw of [...readPhotos(node), ...(parent ? readPhotos(parent) : []), ...metaContent(html, 'og:image')]) {
    const href = absoluteHttps(raw, pageUrl);
    if (href && !photos.includes(href)) photos.push(href);
    if (photos.length >= MAX_PHOTOS) break;
  }
  const coords = readCoords(node);
  const parentCoords = parent ? readCoords(parent) : { latitude: null, longitude: null };
  return {
    sourceUrl: pageUrl,
    title: titleSource ? titleSource.slice(0, 200) : address.slice(0, 200),
    address: address.slice(0, 200),
    priceCents: dollars == null ? null : Math.round(dollars * 100),
    bedrooms: firstValue(node, parent, readBeds),
    bathrooms: firstValue(node, parent, readBaths),
    sqft: firstValue(node, parent, readSqft),
    latitude: coords.latitude ?? parentCoords.latitude,
    longitude: coords.longitude ?? parentCoords.longitude,
    photos,
  };
}

export async function parseListing(rawUrl, options = {}) {
  const url = assertAllowedListingUrl(rawUrl);
  const fetchImpl = options.fetchImpl ?? testFetch ?? globalThis.fetch;
  if (options.fetchImpl == null && testFetch == null) {
    await assertHostnameResolvesPublic(url.hostname);
  }
  let response;
  try {
    response = await fetchImpl(url.href, {
      redirect: 'manual',
      signal: AbortSignal.timeout(LISTING_FETCH_POLICY.timeoutMs),
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Hapstr/0.1 (listing import)',
      },
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new HttpError(504, 'listing_timeout');
    }
    throw new HttpError(422, 'listing_unavailable');
  }
  if (response.redirected || response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new HttpError(422, 'redirect_not_allowed');
  }
  if (response.status !== 200) throw new HttpError(422, 'listing_unavailable');
  const contentType = response.headers.get('content-type') || '';
  if (contentType && !/text\/html|application\/xhtml\+xml|text\/plain|application\/json/i.test(contentType)) {
    throw new HttpError(422, 'listing_unavailable');
  }
  const html = await readLimitedBody(response);
  const listing = extractListing(html, url.href);
  listing.sourceUrl = url.href;
  return listing;
}
