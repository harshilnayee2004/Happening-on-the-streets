import crypto from 'node:crypto';
import { getDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Property } from '../models/Property.js';
import { MEMBER_ROLE, WORKSPACE_KIND, Workspace } from '../models/Workspace.js';
import { DEFAULT_VISIBILITY, VISIBILITY, WorkspaceItem } from '../models/WorkspaceItem.js';
import { Showcase } from '../models/Showcase.js';
import { Referral } from '../models/Referral.js';
import { OpenHouseAlbum } from '../models/OpenHouseAlbum.js';
import { OpenHouseVisit } from '../models/OpenHouseVisit.js';
import { REALTOR_TIER, RealtorAccount } from '../models/RealtorAccount.js';
import { WORKSPACE_EVENT_TYPE, WorkspaceEvent } from '../models/WorkspaceEvent.js';
import {
  assignVisitorSlots,
  buildFiveQuestions,
  durationSeconds,
  extractMentions,
  formatDuration,
  mostCommon,
} from './realtorInsights.js';
import { canReadWorkspaceItem, getActor, workspaceItemVisibilityWhere } from '../middleware/rls.js';
import { HttpError } from '../utils/httpError.js';
import { newId, nowIso } from '../utils/ids.js';
import { assertHttpsUrl } from '../utils/urlPolicy.js';
import { imageType } from '../utils/imageType.js';
import { assertAllowedListingUrl } from './listingParser.js';

const SCHEMA = [
  User,
  Property,
  Workspace,
  WorkspaceItem,
  Showcase,
  Referral,
  OpenHouseAlbum,
  OpenHouseVisit,
  RealtorAccount,
  WorkspaceEvent,
];
const MEMBER_ROLES = new Set(Object.values(MEMBER_ROLE));
const EVENT_TYPES = new Set(Object.values(WORKSPACE_EVENT_TYPE));
const REALTOR_TIERS = new Set(Object.values(REALTOR_TIER));
const VISIBILITIES = new Set(Object.values(VISIBILITY));
const ITEM_KIND = /^[a-z][a-z0-9_]{0,39}$/;

function db() {
  return getDb();
}

function rethrow(err) {
  if (err instanceof HttpError) throw err;
  if (typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
    throw new HttpError(409, 'conflict');
  }
  console.error(err);
  throw new HttpError(500, 'internal_error');
}

function transaction(fn) {
  const database = db();
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      database.exec('ROLLBACK');
    } catch (rollbackErr) {
      console.error(rollbackErr);
    }
    throw err;
  }
}

function text(value, max, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'invalid_input');
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_input');
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (required) throw new HttpError(400, 'invalid_input');
    return null;
  }
  if (trimmed.length > max) throw new HttpError(400, 'invalid_input');
  return trimmed;
}

function optionalNumber(value, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new HttpError(400, 'invalid_input');
  if (integer && !Number.isInteger(value)) throw new HttpError(400, 'invalid_input');
  if (value < min || value > max) throw new HttpError(400, 'invalid_input');
  return value;
}

function actor() {
  return getActor();
}

function notFound() {
  throw new HttpError(404, 'not_found');
}

function columnNames(table) {
  const allowed = new Set([
    'users',
    'properties',
    'workspaces',
    'workspace_members',
    'workspace_items',
    'workspace_item_shares',
    'showcases',
    'access_grants',
    'referrals',
    'open_house_albums',
    'open_house_photos',
    'realtor_accounts',
    'workspace_events',
  ]);
  if (!allowed.has(table)) throw new HttpError(400, 'invalid_input');
  return db().prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

export function migrate() {
  const database = db();
  database.exec('PRAGMA foreign_keys = ON');
  for (const model of SCHEMA) database.exec(model.ddl);
  const grants = columnNames('access_grants');
  const showcases = columnNames('showcases');
  if (!grants.includes('token_hash') || grants.includes('token') || grants.includes('share_token')) {
    throw new HttpError(500, 'internal_error');
  }
  if (showcases.includes('share_token') || showcases.includes('token')) {
    throw new HttpError(500, 'internal_error');
  }
  const propertyColumns = new Set(columnNames('properties'));
  const addedPropertyColumns = [
    ['title', 'TEXT'],
    ['photo_urls', 'TEXT'],
    ['latitude', 'REAL'],
    ['longitude', 'REAL'],
    ['is_demo', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [name, type] of addedPropertyColumns) {
    if (!propertyColumns.has(name)) {
      database.exec(`ALTER TABLE properties ADD COLUMN ${name} ${type}`);
    }
  }
  const memberColumns = new Set(columnNames('workspace_members'));
  if (!memberColumns.has('consent_given')) {
    database.exec('ALTER TABLE workspace_members ADD COLUMN consent_given INTEGER NOT NULL DEFAULT 0');
  }
  if (!memberColumns.has('consent_given_at')) {
    database.exec('ALTER TABLE workspace_members ADD COLUMN consent_given_at TEXT');
  }
  const eventSql = database.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_events'
  `).get()?.sql || '';
  if (eventSql && !eventSql.includes('readiness_override')) {
    database.exec(`
      CREATE TABLE workspace_events_next (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL CHECK (event_type IN (
          'visit',
          'duration_tick',
          'invite',
          'photo_captured',
          'video_captured',
          'room_entered',
          'model_3d_interaction',
          'chat_message',
          'readiness_override'
        )),
        workspace_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        room_label TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (property_id) REFERENCES properties(id),
        FOREIGN KEY (actor_id) REFERENCES users(id)
      );
      INSERT INTO workspace_events_next
        SELECT id, event_type, workspace_id, property_id, actor_id, room_label, created_at
        FROM workspace_events;
      DROP TABLE workspace_events;
      ALTER TABLE workspace_events_next RENAME TO workspace_events;
      CREATE INDEX IF NOT EXISTS idx_workspace_events_workspace ON workspace_events(workspace_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_workspace_events_type ON workspace_events(event_type, created_at);
    `);
  }
  const photoColumns = new Set(columnNames('open_house_photos'));
  if (!photoColumns.has('image') || photoColumns.has('url')) {
    database.exec(`
      CREATE TABLE open_house_photos_next (
        id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        content_type TEXT NOT NULL,
        image BLOB NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (visit_id) REFERENCES open_house_visits(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      DROP TABLE open_house_photos;
      ALTER TABLE open_house_photos_next RENAME TO open_house_photos;
      CREATE INDEX IF NOT EXISTS idx_open_house_photos_visit ON open_house_photos(visit_id, created_at);
    `);
  }
  seedDemoHome();
}

export function securitySchema() {
  return {
    showcases: columnNames('showcases'),
    accessGrants: columnNames('access_grants'),
    workspaceItems: columnNames('workspace_items'),
  };
}

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    phone: row.phone,
    kind: row.kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function provisionUser({ email, displayName, phone } = {}) {
  const normalizedEmail = text(email, 200, { required: true }).toLowerCase();
  if (!normalizedEmail.includes('@') || normalizedEmail.startsWith('@') || normalizedEmail.endsWith('@')) {
    throw new HttpError(400, 'invalid_input');
  }
  const name = text(displayName, 80, { required: true });
  const phoneValue = text(phone, 40);
  const id = newId();
  const now = nowIso();
  try {
    db().prepare(`
      INSERT INTO users (id, email, display_name, phone, kind, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', ?, ?)
    `).run(id, normalizedEmail, name, phoneValue, now, now);
  } catch (err) {
    rethrow(err);
  }
  return mapUser(db().prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function provisionGuest() {
  const id = newId();
  const now = nowIso();
  db().prepare(`
    INSERT INTO users (id, email, display_name, phone, kind, created_at, updated_at)
    VALUES (?, NULL, NULL, NULL, 'guest', ?, ?)
  `).run(id, now, now);
  return { id, kind: 'guest' };
}

export function readUser(id) {
  const current = actor();
  if (id !== current.id) notFound();
  const row = db().prepare('SELECT * FROM users WHERE id = ?').get(current.id);
  if (!row) notFound();
  return mapUser(row);
}

function mapProperty(row) {
  let photoUrls = [];
  if (row.photo_urls) {
    try {
      const parsed = JSON.parse(row.photo_urls);
      if (Array.isArray(parsed)) photoUrls = parsed;
    } catch {
      photoUrls = [];
    }
  }
  return {
    id: row.id,
    address: row.address,
    title: row.title,
    listingUrl: row.listing_url,
    priceCents: row.price_cents,
    photoUrls,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    latitude: row.latitude,
    longitude: row.longitude,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDemo: Number(row.is_demo) === 1,
  };
}

function normalizePhotoUrls(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 12) throw new HttpError(400, 'invalid_input');
  return value.map((url) => assertHttpsUrl(url).href);
}

function propertyVisible(propertyId, userId) {
  return db().prepare(`
    SELECT * FROM properties p
    WHERE p.id = ?
      AND (
        p.created_by = ?
        OR p.is_demo = 1
        OR EXISTS (
          SELECT 1 FROM workspaces w
          JOIN workspace_members m ON m.workspace_id = w.id
          WHERE w.property_id = p.id AND m.user_id = ?
        )
      )
  `).get(propertyId, userId, userId);
}

export function createProperty(input = {}) {
  const current = actor();
  const address = text(input.address, 200, { required: true });
  const title = text(input.title, 200);
  const listingUrl = input.listingUrl ? assertAllowedListingUrl(input.listingUrl).href : null;
  const priceCents = optionalNumber(input.priceCents, { min: 0, max: 100_000_000_000_00, integer: true });
  const photos = JSON.stringify(normalizePhotoUrls(input.photoUrls));
  const beds = optionalNumber(input.beds, { min: 0, max: 100 });
  const baths = optionalNumber(input.baths, { min: 0, max: 100 });
  const sqft = optionalNumber(input.sqft, { min: 0, max: 1_000_000, integer: true });
  const latitude = optionalNumber(input.latitude, { min: -90, max: 90 });
  const longitude = optionalNumber(input.longitude, { min: -180, max: 180 });
  const id = newId();
  const now = nowIso();
  try {
    db().prepare(`
      INSERT INTO properties (
        id, address, title, listing_url, price_cents, photo_urls, beds, baths, sqft,
        latitude, longitude, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      address,
      title,
      listingUrl,
      priceCents,
      photos,
      beds,
      baths,
      sqft,
      latitude,
      longitude,
      current.id,
      now,
      now,
    );
  } catch (err) {
    rethrow(err);
  }
  return mapProperty(db().prepare('SELECT * FROM properties WHERE id = ? AND created_by = ?').get(id, current.id));
}

export function listProperties() {
  const current = actor();
  const rows = db().prepare(`
    SELECT * FROM properties p
    WHERE p.created_by = :actorId
      OR p.is_demo = 1
      OR EXISTS (
        SELECT 1 FROM workspaces w
        JOIN workspace_members m ON m.workspace_id = w.id
        WHERE w.property_id = p.id AND m.user_id = :actorId
      )
    ORDER BY p.is_demo DESC, p.created_at DESC, p.rowid DESC
    LIMIT 100
  `).all({ actorId: current.id });
  return rows.map(mapProperty);
}

function mapWorkspace(row) {
  return {
    id: row.id,
    propertyId: row.property_id,
    kind: row.kind,
    parentWorkspaceId: row.parent_workspace_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function membershipRole(workspaceId, userId) {
  const row = db().prepare(`
    SELECT member_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, userId);
  return row?.member_role ?? null;
}

function requireWorkspace(workspaceId, userId) {
  const row = db().prepare(`
    SELECT w.* FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE w.id = ? AND m.user_id = ?
  `).get(workspaceId, userId);
  if (!row) notFound();
  return row;
}

function ensureRealtorAccount(userId) {
  const now = nowIso();
  db().prepare(`
    INSERT INTO realtor_accounts (user_id, tier, created_at, updated_at)
    VALUES (?, 'free', ?, ?)
    ON CONFLICT(user_id) DO NOTHING
  `).run(userId, now, now);
}

function primaryWorkspaceForActorProperty(propertyId, userId) {
  return db().prepare(`
    SELECT w.* FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE w.property_id = ? AND w.kind = 'primary' AND m.user_id = ?
    ORDER BY w.created_at ASC
    LIMIT 1
  `).get(propertyId, userId);
}

function insertWorkspaceEvent({ eventType, workspaceId, propertyId, roomLabel = null }) {
  const current = actor();
  if (!EVENT_TYPES.has(eventType)) throw new HttpError(400, 'invalid_input');
  const workspace = requireWorkspace(workspaceId, current.id);
  const property = text(propertyId, 80, { required: true });
  if (workspace.property_id !== property) throw new HttpError(400, 'invalid_input');
  const room = roomLabel == null || roomLabel === ''
    ? null
    : text(String(roomLabel), 40, { required: true }).toLowerCase();
  const id = newId();
  const now = nowIso();
  db().prepare(`
    INSERT INTO workspace_events (
      id, event_type, workspace_id, property_id, actor_id, room_label, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, eventType, workspace.id, property, current.id, room, now);
  return {
    id,
    eventType,
    workspaceId: workspace.id,
    propertyId: property,
    actorId: current.id,
    roomLabel: room,
    createdAt: now,
  };
}

function logSignalEvent(eventType, workspaceId, propertyId, roomLabel) {
  if (!workspaceId || !propertyId) return;
  insertWorkspaceEvent({ eventType, workspaceId, propertyId, roomLabel });
}

export function recordWorkspaceEvent(input = {}) {
  return insertWorkspaceEvent({
    eventType: input.eventType,
    workspaceId: text(input.workspaceId, 80, { required: true }),
    propertyId: text(input.propertyId, 80, { required: true }),
    roomLabel: input.roomLabel,
  });
}

export function listWorkspaceEvents(workspaceId) {
  const current = actor();
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), current.id);
  const rows = db().prepare(`
    SELECT * FROM workspace_events
    WHERE workspace_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(workspace.id);
  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    actorId: row.actor_id,
    roomLabel: row.room_label,
    createdAt: row.created_at,
  }));
}

export function readRealtorAccount(userId) {
  const current = actor();
  const id = text(userId, 80, { required: true });
  if (id !== current.id) notFound();
  const row = db().prepare('SELECT * FROM realtor_accounts WHERE user_id = ?').get(id);
  if (!row) {
    return { userId: id, tier: REALTOR_TIER.FREE, createdAt: null, updatedAt: null };
  }
  return {
    userId: row.user_id,
    tier: row.tier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function setRealtorTier(tier) {
  const current = actor();
  if (!REALTOR_TIERS.has(tier)) throw new HttpError(400, 'invalid_input');
  ensureRealtorAccount(current.id);
  const now = nowIso();
  db().prepare('UPDATE realtor_accounts SET tier = ?, updated_at = ? WHERE user_id = ?')
    .run(tier, now, current.id);
  return readRealtorAccount(current.id);
}

export function setOwnMemberConsent(workspaceId, given) {
  const current = actor();
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), current.id);
  if (typeof given !== 'boolean') throw new HttpError(400, 'invalid_input');
  const now = given ? nowIso() : null;
  db().prepare(`
    UPDATE workspace_members
    SET consent_given = ?, consent_given_at = ?
    WHERE workspace_id = ? AND user_id = ?
  `).run(given ? 1 : 0, now, workspace.id, current.id);
  return {
    workspaceId: workspace.id,
    userId: current.id,
    consentGiven: given,
    consentGivenAt: now,
  };
}

function requireOwnedPrimary(workspaceId) {
  const current = actor();
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), current.id);
  if (workspace.kind !== WORKSPACE_KIND.PRIMARY || workspace.created_by !== current.id) notFound();
  return workspace;
}

function premiumContact(userId, consentGiven) {
  if (!consentGiven) {
    return { disclosure: "Buyer hasn't agreed to share contact info" };
  }
  const row = db().prepare('SELECT display_name, email, phone FROM users WHERE id = ?').get(userId);
  return {
    displayName: row?.display_name || 'Name not set',
    email: row?.email || 'No email on file',
    phone: row?.phone || 'No phone on file',
    profileBackground: row?.email ? 'Has an account email on file' : 'Guest in this workspace',
  };
}

export function readRealtorAnalytics(workspaceId) {
  const workspace = requireOwnedPrimary(workspaceId);
  const current = actor();
  const account = readRealtorAccount(current.id);
  const tier = account.tier;
  const events = db().prepare(`
    SELECT event_type, actor_id, room_label, created_at
    FROM workspace_events WHERE workspace_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(workspace.id);
  const visits = db().prepare(`
    SELECT id, created_by, created_at, updated_at
    FROM open_house_visits WHERE property_id = ?
    ORDER BY created_at ASC
  `).all(workspace.property_id);
  const members = db().prepare(`
    SELECT m.user_id, m.member_role, m.consent_given, m.created_at
    FROM workspace_members m
    WHERE m.workspace_id = ?
    ORDER BY m.created_at ASC
  `).all(workspace.id);
  const chat = db().prepare(`
    SELECT created_by, body, created_at FROM workspace_items
    WHERE workspace_id = ? AND kind = 'chat' AND visibility = 'everyone'
    ORDER BY created_at ASC, rowid ASC
  `).all(workspace.id);
  const notes = db().prepare(`
    SELECT n.body, n.created_at, n.created_by, v.created_by AS visit_owner
    FROM open_house_notes n
    JOIN open_house_visits v ON v.id = n.visit_id
    WHERE v.property_id = ?
    ORDER BY n.created_at ASC
  `).all(workspace.property_id);
  const photos = db().prepare(`
    SELECT p.created_by, p.created_at, v.id AS visit_id
    FROM open_house_photos p
    JOIN open_house_visits v ON v.id = p.visit_id
    WHERE v.property_id = ?
  `).all(workspace.property_id);
  const labels = listPhotoLabelsFor(workspace.id);

  const visitCount = events.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.VISIT).length
    || visits.length;
  const inviteCount = events.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.INVITE).length;
  const durations = visits.map((row) => durationSeconds(row.created_at, row.updated_at));
  const durationSecondsTotal = durations.reduce((sum, value) => sum + value, 0);
  const durationSecondsAverage = visits.length > 0
    ? Math.round(durationSecondsTotal / visits.length)
    : 0;

  const free = {
    visitCount,
    durationSecondsTotal,
    durationSecondsAverage,
    durationTotalLabel: `${formatDuration(durationSecondsTotal)} total across visits`,
    durationAverageLabel: `${formatDuration(durationSecondsAverage)} average per visit`,
    inviteCount,
  };

  const payload = {
    workspaceId: workspace.id,
    propertyId: workspace.property_id,
    tier,
    free,
  };
  if (tier === REALTOR_TIER.FREE) return payload;

  const firstSeen = new Map();
  for (const row of members) {
    firstSeen.set(row.user_id, row.created_at);
  }
  for (const row of events) {
    if (!firstSeen.has(row.actor_id) || row.created_at < firstSeen.get(row.actor_id)) {
      firstSeen.set(row.actor_id, row.created_at);
    }
  }
  const people = members.map((row) => ({
    userId: row.user_id,
    role: row.member_role,
    firstSeen: firstSeen.get(row.user_id) || row.created_at,
  }));
  const slots = assignVisitorSlots(people);
  const roles = new Map(members.map((row) => [row.user_id, row.member_role]));
  const consentByUser = new Map(members.map((row) => [row.user_id, Number(row.consent_given) === 1]));

  const visitCards = visits.map((visit) => {
    const actorId = visit.created_by;
    const actorPhotos = photos.filter((row) => row.created_by === actorId);
    const actorEvents = events.filter((row) => row.actor_id === actorId);
    const rooms = [...new Set([
      ...actorEvents.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.ROOM_ENTERED && row.room_label)
        .map((row) => row.room_label),
      ...labels.map((item) => item.room),
    ])];
    const mentions = chat
      .filter((row) => row.created_by === actorId)
      .flatMap((row) => extractMentions(row.body));
    const theme = mostCommon(mentions);
    const card = {
      visitId: visit.id,
      slotLabel: slots.get(actorId) || 'Visitor',
      roleSlot: roles.get(actorId) || 'buyer',
      durationSeconds: durationSeconds(visit.created_at, visit.updated_at),
      durationLabel: formatDuration(durationSeconds(visit.created_at, visit.updated_at)),
      photoCount: actorPhotos.length
        + actorEvents.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.PHOTO_CAPTURED).length,
      videoCount: actorEvents.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.VIDEO_CAPTURED).length,
      rooms,
      discussionTheme: theme.value,
      discussionBasis: theme.value
        ? `Based on ${theme.count} messages tagged @${theme.value}`
        : 'Based on 0 @room tags in this visitor\'s chat',
    };
    if (tier === REALTOR_TIER.PREMIUM) {
      card.consentGiven = consentByUser.get(actorId) === true;
      card.identity = premiumContact(actorId, card.consentGiven);
    }
    return card;
  });

  const activity = members.map((row) => {
    const userId = row.user_id;
    const messageCount = chat.filter((item) => item.created_by === userId).length;
    const photoCount = photos.filter((item) => item.created_by === userId).length;
    const noteCount = notes.filter((item) => item.created_by === userId).length;
    const eventCount = events.filter((item) => item.actor_id === userId).length;
    return {
      userId,
      messages: messageCount,
      photos: photoCount,
      notes: noteCount,
      score: messageCount + photoCount + noteCount + eventCount,
    };
  });

  const questions = buildFiveQuestions({
    activity,
    messages: chat.map((row) => ({
      authorId: row.created_by,
      body: row.body,
      createdAt: row.created_at,
    })),
    notes: notes.map((row) => ({
      body: row.body,
      createdAt: row.created_at,
      roomLabel: labels[0]?.room || null,
    })),
    slots,
    roles,
  });

  const openHouseNotes = notes.map((row) => ({
    body: row.body,
    createdAt: row.created_at,
  }));
  const roomsEntered = [...new Set([
    ...events.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.ROOM_ENTERED && row.room_label)
      .map((row) => row.room_label),
    ...labels.map((item) => item.room),
  ])];

  payload.pro = { visits: visitCards };
  payload.questions = questions;
  payload.openHouse = {
    photoCount: photos.length
      + events.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.PHOTO_CAPTURED).length,
    videoCount: events.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.VIDEO_CAPTURED).length,
    notes: openHouseNotes,
    durationSecondsTotal,
    durationLabel: formatDuration(durationSecondsTotal),
    rooms: roomsEntered,
  };
  payload.online = {
    model3dInteractions: events.filter((row) => row.event_type === WORKSPACE_EVENT_TYPE.MODEL_3D_INTERACTION).length,
    photoVideoEvents: events.filter((row) => (
      row.event_type === WORKSPACE_EVENT_TYPE.PHOTO_CAPTURED
      || row.event_type === WORKSPACE_EVENT_TYPE.VIDEO_CAPTURED
    )).length,
  };
  return payload;
}

export function readQuestionEvidence(workspaceId) {
  const workspace = requireOwnedPrimary(workspaceId);
  const chat = db().prepare(`
    SELECT body FROM workspace_items
    WHERE workspace_id = ? AND kind = 'chat' AND visibility = 'everyone'
    ORDER BY created_at ASC
  `).all(workspace.id);
  const notes = db().prepare(`
    SELECT n.body FROM open_house_notes n
    JOIN open_house_visits v ON v.id = n.visit_id
    WHERE v.property_id = ?
  `).all(workspace.property_id);
  const labels = listPhotoLabelsFor(workspace.id);
  return {
    messages: chat.map((row) => row.body),
    notes: notes.map((row) => row.body),
    rooms: labels.map((item) => item.room),
  };
}

function parseReadinessOverride(body) {
  if (typeof body !== 'string') return null;
  const breakAt = body.indexOf('\n');
  if (breakAt < 1) return null;
  const score = Number(body.slice(0, breakAt).trim());
  const reason = body.slice(breakAt + 1).trim();
  if (!Number.isInteger(score) || score < 0 || score > 100 || !reason) return null;
  return { score, reason };
}

function computeReadiness(workspace) {
  const current = actor();
  const notes = db().prepare(`
    SELECT n.body FROM open_house_notes n
    JOIN open_house_visits v ON v.id = n.visit_id
    WHERE v.property_id = ?
  `).all(workspace.property_id);
  const resolvedNotes = notes.filter((row) => /^\[resolved\]/i.test(row.body || '')).length;
  const openNotes = notes.length - resolvedNotes;
  const messages = Number(db().prepare(`
    SELECT COUNT(*) AS total FROM workspace_items
    WHERE workspace_id = ? AND kind = 'chat' AND visibility = 'everyone'
  `).get(workspace.id).total);
  const visits = Number(db().prepare(`
    SELECT COUNT(*) AS total FROM open_house_visits WHERE property_id = ?
  `).get(workspace.property_id).total);
  const rooms = [...new Set([
    ...listPhotoLabelsFor(workspace.id).map((item) => item.room),
    ...db().prepare(`
      SELECT room_label FROM workspace_events
      WHERE workspace_id = ? AND event_type = 'room_entered' AND room_label IS NOT NULL
    `).all(workspace.id).map((row) => row.room_label),
  ])];
  const consentGiven = db().prepare(`
    SELECT COUNT(*) AS total FROM workspace_members
    WHERE workspace_id = ? AND consent_given = 1
  `).get(workspace.id).total > 0;
  const you = db().prepare(`
    SELECT consent_given FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(workspace.id, current.id);
  const roomScore = Math.min(rooms.length, 6) / 6 * 25;
  const chatScore = Math.min(messages, 8) / 8 * 25;
  const consentScore = consentGiven ? 20 : 0;
  const visitScore = visits > 0 ? 15 : 0;
  const noteScore = notes.length === 0 ? 15 : (resolvedNotes / notes.length) * 15;
  const computed = Math.round(roomScore + chatScore + consentScore + visitScore + noteScore);
  const resolved = [];
  const unresolved = [];
  const blocking = [];
  if (rooms.length > 0) resolved.push(`Based on ${rooms.length} rooms tagged in the workspace`);
  else unresolved.push('Based on 0 rooms tagged in the workspace');
  if (messages > 0) resolved.push(`Based on ${messages} messages tagged in chat`);
  else unresolved.push('Based on 0 messages in this workspace');
  if (consentGiven) resolved.push('Based on consent given in this workspace');
  else blocking.push('Based on 0 consent records — contact stays private');
  if (visits > 0) resolved.push(`Based on ${visits} open-house visits`);
  else unresolved.push('Based on 0 open-house visits');
  if (openNotes === 0) resolved.push('Based on 0 open notes');
  else unresolved.push(`Based on ${openNotes} open notes (prefix a note with [resolved] to close it)`);
  return {
    computed,
    rooms: rooms.length,
    messages,
    visits,
    openNotes,
    resolvedNotes,
    consentGiven,
    yourConsent: Number(you?.consent_given) === 1,
    resolved,
    unresolved,
    blocking,
  };
}

export function readReadiness(workspaceId) {
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), actor().id);
  const signals = computeReadiness(workspace);
  const overrideRow = db().prepare(`
    SELECT body, created_at FROM workspace_items
    WHERE workspace_id = ? AND kind = 'readiness_override' AND visibility = 'everyone'
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(workspace.id);
  const override = overrideRow ? parseReadinessOverride(overrideRow.body) : null;
  return {
    workspaceId: workspace.id,
    score: override ? override.score : signals.computed,
    computed: signals.computed,
    override: override
      ? { score: override.score, reason: override.reason, createdAt: overrideRow.created_at }
      : null,
    resolved: signals.resolved,
    unresolved: signals.unresolved,
    blocking: signals.blocking,
    signals: {
      rooms: signals.rooms,
      messages: signals.messages,
      visits: signals.visits,
      openNotes: signals.openNotes,
      resolvedNotes: signals.resolvedNotes,
      consentGiven: signals.consentGiven,
    },
  };
}

export function overrideReadiness(workspaceId, score, reason) {
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new HttpError(400, 'invalid_input');
  const why = text(reason, 400, { required: true });
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), actor().id);
  createWorkspaceItem({
    workspaceId: workspace.id,
    kind: 'readiness_override',
    body: `${score}\n${why}`,
    visibility: VISIBILITY.EVERYONE,
  });
  insertWorkspaceEvent({
    eventType: WORKSPACE_EVENT_TYPE.READINESS_OVERRIDE,
    workspaceId: workspace.id,
    propertyId: workspace.property_id,
  });
  return readReadiness(workspace.id);
}

export function setBuyerRealtorConsent(workspaceId, userId, given) {
  const current = actor();
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), current.id);
  if (workspace.created_by !== current.id) notFound();
  const memberId = text(userId, 80, { required: true });
  if (typeof given !== 'boolean') throw new HttpError(400, 'invalid_input');
  const member = db().prepare(`
    SELECT user_id, consent_given FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspace.id, memberId);
  if (!member) notFound();
  const now = given ? nowIso() : null;
  db().prepare(`
    UPDATE workspace_members
    SET consent_given = ?, consent_given_at = ?
    WHERE workspace_id = ? AND user_id = ?
  `).run(given ? 1 : 0, now, workspace.id, memberId);
  return {
    workspaceId: workspace.id,
    userId: memberId,
    consentGiven: given,
    consentGivenAt: now,
  };
}

export function readMemberConsent(workspaceId, userId) {
  const current = actor();
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), current.id);
  const memberId = text(userId, 80, { required: true });
  if (workspace.created_by !== current.id && memberId !== current.id) notFound();
  const row = db().prepare(`
    SELECT consent_given, consent_given_at FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspace.id, memberId);
  if (!row) notFound();
  return {
    workspaceId: workspace.id,
    userId: memberId,
    consentGiven: Number(row.consent_given) === 1,
    consentGivenAt: row.consent_given_at,
  };
}

export function createWorkspace(input = {}) {
  const current = actor();
  if (input.kind !== WORKSPACE_KIND.PRIMARY && input.kind !== WORKSPACE_KIND.COLLABORATION) {
    throw new HttpError(400, 'invalid_input');
  }
  const parentWorkspaceId = input.parentWorkspaceId ?? null;
  if (input.kind === WORKSPACE_KIND.PRIMARY && parentWorkspaceId) throw new HttpError(400, 'invalid_input');
  if (input.kind === WORKSPACE_KIND.COLLABORATION && !parentWorkspaceId) throw new HttpError(400, 'invalid_input');
  if (!propertyVisible(input.propertyId, current.id)) notFound();
  if (parentWorkspaceId) requireWorkspace(parentWorkspaceId, current.id);

  const id = newId();
  const now = nowIso();
  const memberRole = input.kind === WORKSPACE_KIND.PRIMARY ? MEMBER_ROLE.REALTOR : MEMBER_ROLE.BUYER;
  try {
    transaction(() => {
      db().prepare(`
        INSERT INTO workspaces (
          id, property_id, kind, parent_workspace_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.propertyId, input.kind, parentWorkspaceId, current.id, now, now);
      db().prepare(`
        INSERT INTO workspace_members (workspace_id, user_id, member_role, created_at)
        VALUES (?, ?, ?, ?)
      `).run(id, current.id, memberRole, now);
    });
  } catch (err) {
    rethrow(err);
  }
  if (memberRole === MEMBER_ROLE.REALTOR) ensureRealtorAccount(current.id);
  return mapWorkspace(requireWorkspace(id, current.id));
}

export function listWorkspaces() {
  const current = actor();
  const rows = db().prepare(`
    SELECT w.* FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE m.user_id = ?
    ORDER BY w.created_at DESC
    LIMIT 100
  `).all(current.id);
  return rows.map(mapWorkspace);
}

export function addWorkspaceMember(workspaceId, userId, memberRole) {
  const current = actor();
  if (!MEMBER_ROLES.has(memberRole)) throw new HttpError(400, 'invalid_input');
  const workspace = requireWorkspace(workspaceId, current.id);
  if (workspace.created_by !== current.id) notFound();
  const target = db().prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!target) notFound();
  try {
    db().prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, member_role, created_at)
      VALUES (?, ?, ?, ?)
    `).run(workspaceId, userId, memberRole, nowIso());
  } catch (err) {
    rethrow(err);
  }
  if (memberRole === MEMBER_ROLE.REALTOR) ensureRealtorAccount(userId);
  return { workspaceId, userId, memberRole };
}

function mapItem(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    kind: row.kind,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkspaceItem(input = {}) {
  const current = actor();
  requireWorkspace(input.workspaceId, current.id);
  if (typeof input.kind !== 'string' || !ITEM_KIND.test(input.kind)) throw new HttpError(400, 'invalid_input');
  const body = text(input.body, 20000);
  const visibility = input.visibility ?? DEFAULT_VISIBILITY;
  if (!VISIBILITIES.has(visibility)) throw new HttpError(400, 'invalid_visibility');
  if (visibility === VISIBILITY.SHARED) throw new HttpError(400, 'invalid_visibility');
  const id = newId();
  const now = nowIso();
  try {
    db().prepare(`
      INSERT INTO workspace_items (
        id, workspace_id, created_by, kind, body, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.workspaceId, current.id, input.kind, body, visibility, now, now);
  } catch (err) {
    rethrow(err);
  }
  const row = db().prepare(`
    SELECT * FROM workspace_items WHERE id = ? AND created_by = ?
  `).get(id, current.id);
  return mapItem(row);
}

export function listWorkspaceItems(workspaceId) {
  const current = actor();
  const role = membershipRole(workspaceId, current.id);
  if (!role) notFound();
  const rows = db().prepare(`
    SELECT
      i.*,
      (SELECT m.member_role FROM workspace_members m
        WHERE m.workspace_id = i.workspace_id AND m.user_id = :actorId) AS actor_role,
      EXISTS(
        SELECT 1 FROM workspace_item_shares s
        WHERE s.item_id = i.id AND s.user_id = :actorId
      ) AS actor_shared
    FROM workspace_items i
    WHERE i.workspace_id = :workspaceId
      AND ${workspaceItemVisibilityWhere('i')}
    ORDER BY i.created_at DESC
    LIMIT 200
  `).all({ actorId: current.id, workspaceId });

  return rows.map((row) => {
    const item = mapItem(row);
    const allowed = canReadWorkspaceItem(
      current,
      item,
      row.actor_role,
      Number(row.actor_shared) === 1,
    );
    if (!allowed) throw new HttpError(500, 'access_check_failed');
    return item;
  });
}

export function setWorkspaceItemVisibility(itemId, visibility, shareWithUserIds = []) {
  const current = actor();
  if (!VISIBILITIES.has(visibility)) throw new HttpError(400, 'invalid_visibility');
  const existing = db().prepare(`
    SELECT * FROM workspace_items WHERE id = ? AND created_by = ?
  `).get(itemId, current.id);
  if (!existing) notFound();
  const recipients = Array.isArray(shareWithUserIds) ? shareWithUserIds : null;
  if (!recipients || recipients.some((id) => typeof id !== 'string')) throw new HttpError(400, 'invalid_input');
  if (visibility === VISIBILITY.SHARED && recipients.length === 0) throw new HttpError(400, 'invalid_input');
  if (visibility !== VISIBILITY.SHARED && recipients.length > 0) throw new HttpError(400, 'invalid_input');
  const uniqueRecipients = [...new Set(recipients)];
  for (const userId of uniqueRecipients) {
    if (!membershipRole(existing.workspace_id, userId)) throw new HttpError(400, 'invalid_input');
  }
  const now = nowIso();
  try {
    transaction(() => {
      db().prepare(`
        UPDATE workspace_items SET visibility = ?, updated_at = ? WHERE id = ? AND created_by = ?
      `).run(visibility, now, itemId, current.id);
      db().prepare('DELETE FROM workspace_item_shares WHERE item_id = ?').run(itemId);
      const insertShare = db().prepare(`
        INSERT INTO workspace_item_shares (item_id, user_id, created_at) VALUES (?, ?, ?)
      `);
      for (const userId of uniqueRecipients) insertShare.run(itemId, userId, now);
    });
  } catch (err) {
    rethrow(err);
  }
  return mapItem(db().prepare('SELECT * FROM workspace_items WHERE id = ? AND created_by = ?').get(itemId, current.id));
}

function mapShowcase(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    modelUrl: row.model_url,
    latitude: row.latitude,
    longitude: row.longitude,
    rotation: row.rotation,
    scale: row.scale,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createShowcase(input = {}) {
  const current = actor();
  requireWorkspace(input.workspaceId, current.id);
  const modelUrl = input.modelUrl ? assertHttpsUrl(input.modelUrl).href : null;
  const latitude = optionalNumber(input.latitude, { min: -90, max: 90 });
  const longitude = optionalNumber(input.longitude, { min: -180, max: 180 });
  const rotation = optionalNumber(input.rotation, { min: -360, max: 360 });
  const scale = optionalNumber(input.scale, { min: 0, max: 1000 });
  const id = newId();
  const now = nowIso();
  try {
    db().prepare(`
      INSERT INTO showcases (
        id, workspace_id, model_url, latitude, longitude, rotation, scale, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.workspaceId, modelUrl, latitude, longitude, rotation, scale, current.id, now, now);
  } catch (err) {
    rethrow(err);
  }
  return readShowcase(input.workspaceId);
}

export function readShowcase(workspaceId) {
  const showcase = readShowcaseOptional(workspaceId);
  if (!showcase) notFound();
  return showcase;
}

export function readShowcaseOptional(workspaceId) {
  const current = actor();
  requireWorkspace(workspaceId, current.id);
  const row = db().prepare('SELECT * FROM showcases WHERE workspace_id = ?').get(workspaceId);
  if (!row) return null;
  const showcase = mapShowcase(row);
  if ('shareToken' in showcase || 'token' in showcase) throw new HttpError(500, 'access_check_failed');
  return showcase;
}

export function upsertShowcase(workspaceId, input = {}) {
  const workspace = requireOwnedPrimary(workspaceId);
  const existing = db().prepare('SELECT * FROM showcases WHERE workspace_id = ?').get(workspace.id);
  if (!existing) {
    return createShowcase({
      workspaceId: workspace.id,
      modelUrl: input.modelUrl,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      rotation: input.rotation ?? null,
      scale: input.scale ?? null,
    });
  }
  const modelUrl = input.modelUrl ? assertHttpsUrl(input.modelUrl).href : null;
  const latitude = optionalNumber(input.latitude, { min: -90, max: 90 });
  const longitude = optionalNumber(input.longitude, { min: -180, max: 180 });
  const rotation = optionalNumber(input.rotation, { min: -360, max: 360 });
  const scale = optionalNumber(input.scale, { min: 0, max: 1000 });
  const now = nowIso();
  db().prepare(`
    UPDATE showcases
    SET model_url = ?, latitude = ?, longitude = ?, rotation = ?, scale = ?, updated_at = ?
    WHERE workspace_id = ?
  `).run(modelUrl, latitude, longitude, rotation, scale, now, workspace.id);
  return readShowcase(workspace.id);
}

function mapReferral(row) {
  return {
    id: row.id,
    createdBy: row.created_by,
    leadType: row.lead_type,
    location: row.location,
    propertyType: row.property_type,
    budgetRange: row.budget_range,
    timeline: row.timeline,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createReferral(input = {}) {
  const current = actor();
  const id = newId();
  const now = nowIso();
  const values = {
    leadType: text(input.leadType, 80),
    location: text(input.location, 120),
    propertyType: text(input.propertyType, 80),
    budgetRange: text(input.budgetRange, 80),
    timeline: text(input.timeline, 80),
    contactName: text(input.contactName, 80),
    contactPhone: text(input.contactPhone, 40),
    contactEmail: text(input.contactEmail, 200)?.toLowerCase() ?? null,
  };
  try {
    db().prepare(`
      INSERT INTO referrals (
        id, created_by, lead_type, location, property_type, budget_range, timeline,
        contact_name, contact_phone, contact_email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      current.id,
      values.leadType,
      values.location,
      values.propertyType,
      values.budgetRange,
      values.timeline,
      values.contactName,
      values.contactPhone,
      values.contactEmail,
      now,
      now,
    );
  } catch (err) {
    rethrow(err);
  }
  return readReferral(id);
}

export function listReferrals() {
  const current = actor();
  const rows = db().prepare(`
    SELECT * FROM referrals WHERE created_by = ? ORDER BY created_at DESC LIMIT 100
  `).all(current.id);
  return rows.map(mapReferral);
}

export function readReferral(id) {
  const current = actor();
  const row = db().prepare('SELECT * FROM referrals WHERE id = ? AND created_by = ?').get(id, current.id);
  if (!row) notFound();
  return mapReferral(row);
}

function publicReferral(row) {
  return {
    id: row.id,
    leadType: row.lead_type,
    location: row.location,
    propertyType: row.property_type,
    budgetRange: row.budget_range,
    timeline: row.timeline,
    createdAt: row.created_at,
    contactLocked: true,
  };
}

function networkUserIds(userId) {
  return db().prepare(`
    SELECT DISTINCT m2.user_id AS id
    FROM workspace_members m1
    JOIN workspace_members m2 ON m1.workspace_id = m2.workspace_id
    WHERE m1.user_id = ? AND m2.user_id != ?
  `).all(userId, userId).map((row) => row.id);
}

function referralMatchesQuery(row, query) {
  if (!query) return true;
  const hay = [row.lead_type, row.location, row.property_type, row.budget_range, row.timeline]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(query);
}

export function searchReferrals({ query, scope } = {}) {
  const current = actor();
  const q = text(query, 80)?.toLowerCase() || '';
  const wanted = scope === 'beyond' ? 'beyond' : 'network';
  const network = new Set(networkUserIds(current.id));
  const rows = db().prepare(`
    SELECT * FROM referrals WHERE created_by != ? ORDER BY created_at DESC LIMIT 200
  `).all(current.id);
  const filtered = rows.filter((row) => {
    if (!referralMatchesQuery(row, q)) return false;
    const inNetwork = network.has(row.created_by);
    return wanted === 'network' ? inNetwork : !inNetwork;
  });
  return {
    scope: wanted,
    query: q || null,
    results: filtered.map(publicReferral),
  };
}

function fieldTokens(value) {
  return new Set(String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 1));
}

function overlapCount(a, b) {
  const left = fieldTokens(a);
  let count = 0;
  for (const token of fieldTokens(b)) {
    if (left.has(token)) count += 1;
  }
  return count;
}

export function explainReferralMatch(leadId, candidateId) {
  const current = actor();
  const mine = db().prepare('SELECT * FROM referrals WHERE id = ? AND created_by = ?').get(
    text(leadId, 80, { required: true }),
    current.id,
  );
  const other = db().prepare('SELECT * FROM referrals WHERE id = ?').get(text(candidateId, 80, { required: true }));
  if (!mine || !other || other.created_by === current.id) notFound();
  const reasons = [];
  const locationHits = overlapCount(mine.location, other.location);
  const typeHits = overlapCount(mine.property_type, other.property_type);
  const budgetHits = overlapCount(mine.budget_range, other.budget_range);
  const timeHits = overlapCount(mine.timeline, other.timeline);
  if (locationHits) reasons.push(`Based on ${locationHits} overlapping location tokens`);
  if (typeHits) reasons.push(`Based on ${typeHits} overlapping property-type tokens`);
  if (budgetHits) reasons.push(`Based on ${budgetHits} overlapping budget tokens`);
  if (timeHits) reasons.push(`Based on ${timeHits} overlapping timeline tokens`);
  if (reasons.length === 0) reasons.push('Based on 0 overlapping fields — weak match');
  const score = Math.min(100, (locationHits * 20) + (typeHits * 15) + (budgetHits * 10) + (timeHits * 10));
  const network = new Set(networkUserIds(current.id));
  return {
    score,
    scope: network.has(other.created_by) ? 'network' : 'beyond',
    reasons,
    lead: publicReferral(mine),
    candidate: publicReferral(other),
  };
}

export function unlockReferral() {
  throw new HttpError(501, 'payment_not_implemented');
}

function mapAlbum(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOpenHouseAlbum(input = {}) {
  const current = actor();
  requireWorkspace(input.workspaceId, current.id);
  const title = text(input.title, 120);
  const id = newId();
  const now = nowIso();
  try {
    db().prepare(`
      INSERT INTO open_house_albums (id, workspace_id, created_by, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.workspaceId, current.id, title, now, now);
  } catch (err) {
    rethrow(err);
  }
  return readOpenHouseAlbum(id);
}

export function listOpenHouseAlbums(workspaceId) {
  const current = actor();
  requireWorkspace(workspaceId, current.id);
  const rows = db().prepare(`
    SELECT * FROM open_house_albums
    WHERE workspace_id = ? AND created_by = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(workspaceId, current.id);
  return rows.map(mapAlbum);
}

export function readOpenHouseAlbum(id) {
  const current = actor();
  const row = db().prepare(`
    SELECT * FROM open_house_albums WHERE id = ? AND created_by = ?
  `).get(id, current.id);
  if (!row) notFound();
  return mapAlbum(row);
}

const MAX_VISIT_NOTES = 50;
const MAX_VISIT_PHOTOS = 12;

function mapVisit(row) {
  const notes = db().prepare(`
    SELECT id, body, created_at FROM open_house_notes
    WHERE visit_id = ? AND created_by = ?
    ORDER BY created_at ASC, rowid ASC
    LIMIT ?
  `).all(row.id, row.created_by, MAX_VISIT_NOTES);
  const photos = db().prepare(`
    SELECT id, content_type, created_at FROM open_house_photos
    WHERE visit_id = ? AND created_by = ?
    ORDER BY created_at ASC, rowid ASC
    LIMIT ?
  `).all(row.id, row.created_by, MAX_VISIT_PHOTOS);
  return {
    id: row.id,
    propertyId: row.property_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes: notes.map((note) => ({ id: note.id, body: note.body, createdAt: note.created_at })),
    photos: photos.map((photo) => ({
      id: photo.id,
      contentType: photo.content_type,
      createdAt: photo.created_at,
    })),
  };
}

function readOwnVisit(id) {
  const current = actor();
  const row = db().prepare(`
    SELECT * FROM open_house_visits WHERE id = ? AND created_by = ?
  `).get(id, current.id);
  if (!row) notFound();
  if (!propertyVisible(row.property_id, current.id)) notFound();
  return row;
}

export function startOpenHouseVisit(propertyId) {
  const current = actor();
  const idValue = text(propertyId, 80, { required: true });
  if (!propertyVisible(idValue, current.id)) notFound();
  const existing = db().prepare(`
    SELECT * FROM open_house_visits WHERE property_id = ? AND created_by = ?
  `).get(idValue, current.id);
  if (existing) return { visit: mapVisit(existing), created: false };
  const id = newId();
  const now = nowIso();
  try {
    db().prepare(`
      INSERT INTO open_house_visits (id, property_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, idValue, current.id, now, now);
  } catch (err) {
    rethrow(err);
  }
  const row = db().prepare(`
    SELECT * FROM open_house_visits WHERE id = ? AND created_by = ?
  `).get(id, current.id);
  const workspace = primaryWorkspaceForActorProperty(idValue, current.id);
  if (workspace) {
    logSignalEvent(WORKSPACE_EVENT_TYPE.VISIT, workspace.id, idValue);
  }
  return { visit: mapVisit(row), created: true };
}

export function listOpenHouseVisits() {
  const current = actor();
  const rows = db().prepare(`
    SELECT * FROM open_house_visits
    WHERE created_by = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 100
  `).all(current.id);
  return rows.filter((row) => propertyVisible(row.property_id, current.id)).map(mapVisit);
}

export function addOpenHouseNote(visitId, body) {
  const current = actor();
  const row = readOwnVisit(text(visitId, 80, { required: true }));
  const note = text(body, 2000, { required: true });
  const count = Number(db().prepare(`
    SELECT COUNT(*) AS total FROM open_house_notes WHERE visit_id = ? AND created_by = ?
  `).get(row.id, current.id).total);
  if (count >= MAX_VISIT_NOTES) throw new HttpError(400, 'invalid_input');
  const id = newId();
  const now = nowIso();
  try {
    db().prepare(`
      INSERT INTO open_house_notes (id, visit_id, created_by, body, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, row.id, current.id, note, now);
    db().prepare('UPDATE open_house_visits SET updated_at = ? WHERE id = ? AND created_by = ?')
      .run(now, row.id, current.id);
  } catch (err) {
    rethrow(err);
  }
  return mapVisit(readOwnVisit(row.id));
}

export function addOpenHousePhoto(visitId, bytes) {
  const current = actor();
  const row = readOwnVisit(text(visitId, 80, { required: true }));
  const contentType = imageType(bytes);
  if (!contentType) throw new HttpError(400, 'invalid_photo');
  const count = Number(db().prepare(`
    SELECT COUNT(*) AS total FROM open_house_photos WHERE visit_id = ? AND created_by = ?
  `).get(row.id, current.id).total);
  if (count >= MAX_VISIT_PHOTOS) throw new HttpError(400, 'invalid_input');
  const id = newId();
  const now = nowIso();
  const image = Buffer.from(bytes);
  try {
    db().prepare(`
      INSERT INTO open_house_photos (id, visit_id, created_by, content_type, image, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, row.id, current.id, contentType, image, now);
    db().prepare('UPDATE open_house_visits SET updated_at = ? WHERE id = ? AND created_by = ?')
      .run(now, row.id, current.id);
  } catch (err) {
    rethrow(err);
  }
  const workspace = primaryWorkspaceForActorProperty(row.property_id, current.id);
  if (workspace) {
    logSignalEvent(WORKSPACE_EVENT_TYPE.PHOTO_CAPTURED, workspace.id, row.property_id);
  }
  return mapVisit(readOwnVisit(row.id));
}

export function readOpenHousePhoto(visitId, photoId) {
  const current = actor();
  const visit = readOwnVisit(text(visitId, 80, { required: true }));
  const row = db().prepare(`
    SELECT content_type, image FROM open_house_photos
    WHERE id = ? AND visit_id = ? AND created_by = ?
  `).get(text(photoId, 80, { required: true }), visit.id, current.id);
  if (!row?.image) notFound();
  return { contentType: row.content_type, bytes: row.image };
}

const SHARE_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;
const MAX_SHARE_GRANTS = 10;
const MAX_CHAT_MESSAGES = 200;

function hashShareToken(token) {
  return crypto.createHmac('sha256', env.authSecret).update(token).digest('hex');
}

export const DEMO_PROPERTY_ID = 'prop_hapstr_demo_home';
export const DEMO_WORKSPACE_ID = 'ws_hapstr_demo_home';
const DEMO_USER_ID = 'usr_hapstr_demo_owner';
const DEMO_GRANT_ID = 'grant_hapstr_demo_home';

const DEMO_PHOTOS = Object.freeze({
  exterior: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=80',
  kitchen: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=1400&q=80',
  living: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1400&q=80',
  bedroom: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1400&q=80',
  bathroom: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1400&q=80',
});

export function demoShareToken() {
  return crypto.createHmac('sha256', env.authSecret).update('hapstr.demo.share.v1').digest('base64url');
}

export function seedDemoHome() {
  const now = nowIso();
  const photos = JSON.stringify([
    DEMO_PHOTOS.exterior,
    DEMO_PHOTOS.kitchen,
    DEMO_PHOTOS.living,
    DEMO_PHOTOS.bedroom,
    DEMO_PHOTOS.bathroom,
  ]);
  const tokenHash = hashShareToken(demoShareToken());
  transaction(() => {
    db().prepare(`
      INSERT INTO users (id, email, display_name, phone, kind, created_at, updated_at)
      VALUES (?, NULL, 'Demo host', NULL, 'user', ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(DEMO_USER_ID, now, now);
    db().prepare(`
      INSERT INTO properties (
        id, address, title, listing_url, price_cents, photo_urls, beds, baths, sqft,
        latitude, longitude, created_by, created_at, updated_at, is_demo
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO NOTHING
    `).run(
      DEMO_PROPERTY_ID,
      '123 Sample St, Oakland, CA 94611',
      'Demo Home — 123 Sample St',
      87500000,
      photos,
      3,
      2,
      1680,
      37.8044,
      -122.2712,
      DEMO_USER_ID,
      now,
      now,
    );
    db().prepare(`
      INSERT INTO workspaces (
        id, property_id, kind, parent_workspace_id, created_by, created_at, updated_at
      ) VALUES (?, ?, 'primary', NULL, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(DEMO_WORKSPACE_ID, DEMO_PROPERTY_ID, DEMO_USER_ID, now, now);
    db().prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, member_role, created_at)
      VALUES (?, ?, 'realtor', ?)
      ON CONFLICT(workspace_id, user_id) DO NOTHING
    `).run(DEMO_WORKSPACE_ID, DEMO_USER_ID, now);
    db().prepare(`
      INSERT INTO realtor_accounts (user_id, tier, created_at, updated_at)
      VALUES (?, 'free', ?, ?)
      ON CONFLICT(user_id) DO NOTHING
    `).run(DEMO_USER_ID, now, now);
    db().prepare(`
      INSERT INTO access_grants (id, workspace_id, token_hash, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(DEMO_GRANT_ID, DEMO_WORKSPACE_ID, tokenHash, DEMO_USER_ID, now);
    const labeled = db().prepare(`
      SELECT COUNT(*) AS total FROM workspace_items
      WHERE workspace_id = ? AND kind = 'photo_label'
    `).get(DEMO_WORKSPACE_ID);
    if (Number(labeled.total) === 0) {
      for (const [room, url] of Object.entries(DEMO_PHOTOS)) {
        db().prepare(`
          INSERT INTO workspace_items (
            id, workspace_id, created_by, kind, body, visibility, created_at, updated_at
          ) VALUES (?, ?, ?, 'photo_label', ?, 'everyone', ?, ?)
        `).run(`${DEMO_WORKSPACE_ID}_${room}`, DEMO_WORKSPACE_ID, DEMO_USER_ID, `${room}\n${url}`, now, now);
      }
    }
  });
  return {
    propertyId: DEMO_PROPERTY_ID,
    workspaceId: DEMO_WORKSPACE_ID,
    photoCount: 5,
  };
}

export function readDemoInvite() {
  seedDemoHome();
  const property = db().prepare('SELECT * FROM properties WHERE id = ?').get(DEMO_PROPERTY_ID);
  const workspace = db().prepare('SELECT * FROM workspaces WHERE id = ?').get(DEMO_WORKSPACE_ID);
  return {
    token: demoShareToken(),
    workspace: mapWorkspace(workspace),
    property: mapProperty(property),
  };
}

function memberLabel(displayName, userId, hostId) {
  if (displayName) return displayName;
  return userId === hostId ? 'Host' : 'Guest';
}

export function readProperty(id) {
  const current = actor();
  const row = propertyVisible(text(id, 80, { required: true }), current.id);
  if (!row) notFound();
  return mapProperty(row);
}

function ownedPrimaryWorkspace(propertyId, userId) {
  return db().prepare(`
    SELECT * FROM workspaces
    WHERE property_id = ? AND created_by = ? AND kind = 'primary'
    ORDER BY created_at ASC
    LIMIT 1
  `).get(propertyId, userId);
}

export function shareCollectedHome(propertyId) {
  const current = actor();
  const id = text(propertyId, 80, { required: true });
  if (id === DEMO_PROPERTY_ID) return readDemoInvite();
  const propertyRow = db().prepare('SELECT * FROM properties WHERE id = ? AND created_by = ?').get(id, current.id);
  if (!propertyRow) notFound();
  if (Number(propertyRow.is_demo) === 1) return readDemoInvite();

  let workspace = ownedPrimaryWorkspace(id, current.id);
  if (!workspace) {
    const created = createWorkspace({ propertyId: id, kind: WORKSPACE_KIND.PRIMARY });
    workspace = requireWorkspace(created.id, current.id);
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const now = nowIso();
  const grants = db().prepare(`
    SELECT id FROM access_grants WHERE workspace_id = ? ORDER BY created_at ASC
  `).all(workspace.id);
  try {
    transaction(() => {
      if (grants.length >= MAX_SHARE_GRANTS) {
        db().prepare('DELETE FROM access_grants WHERE id = ?').run(grants[0].id);
      }
      db().prepare(`
        INSERT INTO access_grants (id, workspace_id, token_hash, created_by, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(newId(), workspace.id, hashShareToken(token), current.id, now);
    });
  } catch (err) {
    rethrow(err);
  }
  return {
    token,
    workspace: mapWorkspace(workspace),
    property: mapProperty(propertyRow),
  };
}

function packSharedWorkspace(workspaceRow, current) {
  const propertyRow = propertyVisible(workspaceRow.property_id, current.id);
  if (!propertyRow) notFound();
  const members = db().prepare(`
    SELECT u.id, u.display_name, m.member_role, m.consent_given
    FROM workspace_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.workspace_id = ?
    ORDER BY m.created_at ASC
  `).all(workspaceRow.id);
  return {
    workspace: mapWorkspace(workspaceRow),
    property: mapProperty(propertyRow),
    members: members.map((row) => ({
      id: row.id,
      displayName: memberLabel(row.display_name, row.id, workspaceRow.created_by),
      role: row.member_role,
      isYou: row.id === current.id,
      isHost: row.id === workspaceRow.created_by,
      consentGiven: row.id === current.id ? Number(row.consent_given) === 1 : undefined,
    })),
    photoLabels: listPhotoLabelsFor(workspaceRow.id),
    showcase: (() => {
      const row = db().prepare('SELECT * FROM showcases WHERE workspace_id = ?').get(workspaceRow.id);
      return row ? mapShowcase(row) : null;
    })(),
  };
}

const ROOM_SLUG = /^(room|kitchen|living|dining|bedroom|bathroom|office|garage|backyard|patio|basement|attic|laundry|foyer|hallway|exterior)$/;

function parsePhotoLabelBody(body) {
  if (typeof body !== 'string') return null;
  const breakAt = body.indexOf('\n');
  if (breakAt < 1) return null;
  const room = body.slice(0, breakAt).trim().toLowerCase();
  const photoUrl = body.slice(breakAt + 1).trim();
  if (!ROOM_SLUG.test(room) || !photoUrl) return null;
  return { room, photoUrl };
}

function listPhotoLabelsFor(workspaceId) {
  const rows = db().prepare(`
    SELECT body FROM workspace_items
    WHERE workspace_id = ? AND kind = 'photo_label' AND visibility = 'everyone'
    ORDER BY updated_at DESC, rowid DESC
  `).all(workspaceId);
  const seenRoom = new Set();
  const seenUrl = new Set();
  const labels = [];
  for (const row of rows) {
    const parsed = parsePhotoLabelBody(row.body);
    if (!parsed || seenRoom.has(parsed.room) || seenUrl.has(parsed.photoUrl)) continue;
    seenRoom.add(parsed.room);
    seenUrl.add(parsed.photoUrl);
    labels.push(parsed);
  }
  return labels;
}

export function listPhotoLabels(workspaceId) {
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), actor().id);
  return listPhotoLabelsFor(workspace.id);
}

export function setPhotoLabel(workspaceId, photoUrl, roomSlug) {
  const current = actor();
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), current.id);
  const property = propertyVisible(workspace.property_id, current.id);
  if (!property) notFound();
  const photos = mapProperty(property).photoUrls;
  const url = text(photoUrl, 2000, { required: true });
  if (!photos.includes(url)) throw new HttpError(400, 'invalid_input');
  const room = roomSlug == null || roomSlug === '' ? '' : text(String(roomSlug), 40, { required: true }).toLowerCase();
  if (room && !ROOM_SLUG.test(room)) throw new HttpError(400, 'invalid_input');

  const existing = db().prepare(`
    SELECT id, body FROM workspace_items
    WHERE workspace_id = ? AND kind = 'photo_label' AND visibility = 'everyone'
  `).all(workspace.id);
  const now = nowIso();
  transaction(() => {
    for (const row of existing) {
      const parsed = parsePhotoLabelBody(row.body);
      if (!parsed) continue;
      if (parsed.photoUrl === url || (room && parsed.room === room)) {
        db().prepare('DELETE FROM workspace_items WHERE id = ?').run(row.id);
      }
    }
    if (room) {
      db().prepare(`
        INSERT INTO workspace_items (
          id, workspace_id, created_by, kind, body, visibility, created_at, updated_at
        ) VALUES (?, ?, ?, 'photo_label', ?, 'everyone', ?, ?)
      `).run(newId(), workspace.id, current.id, `${room}\n${url}`, now, now);
    }
    db().prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(now, workspace.id);
  });
  if (room) {
    logSignalEvent(WORKSPACE_EVENT_TYPE.ROOM_ENTERED, workspace.id, workspace.property_id, room);
  }
  return listPhotoLabelsFor(workspace.id);
}

export function listRealtorDashboard() {
  const current = actor();
  const rows = db().prepare(`
    SELECT w.*,
      p.id AS listed_property_id,
      p.address AS listed_address,
      p.title AS listed_title,
      p.listing_url AS listed_listing_url,
      p.price_cents AS listed_price_cents,
      p.photo_urls AS listed_photo_urls,
      p.beds AS listed_beds,
      p.baths AS listed_baths,
      p.sqft AS listed_sqft,
      p.latitude AS listed_latitude,
      p.longitude AS listed_longitude,
      p.created_by AS listed_created_by,
      p.created_at AS listed_created_at,
      p.updated_at AS listed_updated_at,
      p.is_demo AS listed_is_demo
    FROM workspaces w
    JOIN properties p ON p.id = w.property_id
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE w.kind = 'primary' AND w.created_by = ? AND m.user_id = ? AND m.member_role = 'realtor'
    ORDER BY w.updated_at DESC, w.rowid DESC
    LIMIT 50
  `).all(current.id, current.id);
  return rows.map((row) => {
    const members = Number(db().prepare(`
      SELECT COUNT(*) AS total FROM workspace_members WHERE workspace_id = ?
    `).get(row.id).total);
    const messages = Number(db().prepare(`
      SELECT COUNT(*) AS total FROM workspace_items
      WHERE workspace_id = ? AND kind = 'chat' AND visibility = 'everyone'
    `).get(row.id).total);
    const visits = Number(db().prepare(`
      SELECT COUNT(*) AS total FROM open_house_visits WHERE property_id = ?
    `).get(row.property_id).total);
    return {
      workspace: mapWorkspace(row),
      property: mapProperty({
        id: row.listed_property_id,
        address: row.listed_address,
        title: row.listed_title,
        listing_url: row.listed_listing_url,
        price_cents: row.listed_price_cents,
        photo_urls: row.listed_photo_urls,
        beds: row.listed_beds,
        baths: row.listed_baths,
        sqft: row.listed_sqft,
        latitude: row.listed_latitude,
        longitude: row.listed_longitude,
        created_by: row.listed_created_by,
        created_at: row.listed_created_at,
        updated_at: row.listed_updated_at,
        is_demo: row.listed_is_demo,
      }),
      visitors: Math.max(0, members - 1),
      members,
      messages,
      visits,
      lastMessage: lastChatMessage(row, current),
    };
  });
}

export function joinWorkspaceByToken(rawToken) {
  const current = actor();
  if (typeof rawToken !== 'string' || !SHARE_TOKEN.test(rawToken)) notFound();
  const grant = db().prepare('SELECT * FROM access_grants WHERE token_hash = ?').get(hashShareToken(rawToken));
  if (!grant) notFound();
  if (!membershipRole(grant.workspace_id, current.id)) {
    try {
      db().prepare(`
        INSERT INTO workspace_members (workspace_id, user_id, member_role, created_at)
        VALUES (?, ?, ?, ?)
      `).run(grant.workspace_id, current.id, MEMBER_ROLE.FAMILY, nowIso());
    } catch (err) {
      rethrow(err);
    }
    const workspaceRow = requireWorkspace(grant.workspace_id, current.id);
    logSignalEvent(WORKSPACE_EVENT_TYPE.INVITE, workspaceRow.id, workspaceRow.property_id);
  }
  const workspace = requireWorkspace(grant.workspace_id, current.id);
  return packSharedWorkspace(workspace, current);
}

function ensureDemoWorkspaceMember(userId) {
  seedDemoHome();
  if (membershipRole(DEMO_WORKSPACE_ID, userId)) return;
  db().prepare(`
    INSERT INTO workspace_members (workspace_id, user_id, member_role, created_at)
    VALUES (?, ?, ?, ?)
  `).run(DEMO_WORKSPACE_ID, userId, MEMBER_ROLE.FAMILY, nowIso());
}

export function readSharedWorkspace(workspaceId) {
  const current = actor();
  const id = text(workspaceId, 80, { required: true });
  if (id === DEMO_WORKSPACE_ID) ensureDemoWorkspaceMember(current.id);
  const workspace = requireWorkspace(id, current.id);
  return packSharedWorkspace(workspace, current);
}

function lastChatMessage(workspaceRow, current) {
  const row = db().prepare(`
    SELECT i.id, i.body, i.created_by, i.created_at, u.display_name
    FROM workspace_items i
    JOIN users u ON u.id = i.created_by
    WHERE i.workspace_id = ? AND i.kind = 'chat' AND i.visibility = 'everyone'
    ORDER BY i.created_at DESC, i.rowid DESC
    LIMIT 1
  `).get(workspaceRow.id);
  if (!row) return null;
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorId: row.created_by,
    authorName: memberLabel(row.display_name, row.created_by, workspaceRow.created_by),
    isYou: row.created_by === current.id,
  };
}

export function listSharedWorkspaces() {
  const current = actor();
  const rows = db().prepare(`
    SELECT w.* FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE m.user_id = ?
    ORDER BY w.updated_at DESC, w.rowid DESC
    LIMIT 100
  `).all(current.id);
  return rows.flatMap((row) => {
    const propertyRow = propertyVisible(row.property_id, current.id);
    if (!propertyRow) return [];
    return [{
      workspace: mapWorkspace(row),
      property: mapProperty(propertyRow),
      isHost: row.created_by === current.id,
      lastMessage: lastChatMessage(row, current),
      photoLabels: listPhotoLabelsFor(row.id),
    }];
  });
}

export function listWorkspaceChat(workspaceId) {
  const current = actor();
  const workspace = requireWorkspace(text(workspaceId, 80, { required: true }), current.id);
  const rows = db().prepare(`
    SELECT i.id, i.body, i.created_by, i.created_at, u.display_name
    FROM workspace_items i
    JOIN users u ON u.id = i.created_by
    WHERE i.workspace_id = ? AND i.kind = 'chat' AND i.visibility = 'everyone'
    ORDER BY i.created_at ASC, i.rowid ASC
    LIMIT ?
  `).all(workspace.id, MAX_CHAT_MESSAGES);
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorId: row.created_by,
    authorName: memberLabel(row.display_name, row.created_by, workspace.created_by),
    isYou: row.created_by === current.id,
  }));
}

export function postWorkspaceChat(workspaceId, body) {
  const id = text(workspaceId, 80, { required: true });
  requireWorkspace(id, actor().id);
  const message = text(body, 2000, { required: true });
  const count = Number(db().prepare(`
    SELECT COUNT(*) AS total FROM workspace_items WHERE workspace_id = ? AND kind = 'chat'
  `).get(id).total);
  if (count >= MAX_CHAT_MESSAGES) throw new HttpError(400, 'invalid_input');
  createWorkspaceItem({
    workspaceId: id,
    kind: 'chat',
    body: message,
    visibility: VISIBILITY.EVERYONE,
  });
  const workspace = requireWorkspace(id, actor().id);
  logSignalEvent(WORKSPACE_EVENT_TYPE.CHAT_MESSAGE, workspace.id, workspace.property_id);
  db().prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(nowIso(), id);
  return listWorkspaceChat(id);
}

export function updateOwnDisplayName(displayName) {
  const current = actor();
  const name = text(displayName, 40, { required: true });
  const now = nowIso();
  db().prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(name, now, current.id);
  return { id: current.id, displayName: name, kind: current.kind };
}
