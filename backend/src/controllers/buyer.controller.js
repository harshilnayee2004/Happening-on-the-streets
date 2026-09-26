import { HttpError } from '../utils/httpError.js';
import { runWithActor } from '../middleware/rls.js';
import {
  addOpenHouseNote,
  addOpenHousePhoto,
  joinWorkspaceByToken,
  listOpenHouseVisits,
  listProperties,
  listSharedWorkspaces,
  listWorkspaceChat,
  postWorkspaceChat,
  readOpenHousePhoto,
  readSharedWorkspace,
  setPhotoLabel,
  shareCollectedHome,
  startOpenHouseVisit,
  updateOwnDisplayName,
} from '../services/dataAccess.js';
import { importListingForActor } from '../services/collectListings.js';

export async function importListing(req, res) {
  const url = req.body?.url;
  if (typeof url !== 'string' || url.trim().length === 0) throw new HttpError(400, 'invalid_input');
  const property = await importListingForActor(req.actor, url.trim());
  res.status(201).json({ property });
}

export function listListings(req, res) {
  const properties = runWithActor(req.actor, () => listProperties());
  res.json({ properties });
}

export function startVisit(req, res) {
  const propertyId = req.body?.propertyId;
  if (typeof propertyId !== 'string' || propertyId.trim().length === 0) {
    throw new HttpError(400, 'invalid_input');
  }
  const result = runWithActor(req.actor, () => startOpenHouseVisit(propertyId.trim()));
  res.status(result.created ? 201 : 200).json({ visit: result.visit });
}

export function listVisits(req, res) {
  const visits = runWithActor(req.actor, () => listOpenHouseVisits());
  res.json({ visits });
}

export function addVisitNote(req, res) {
  const body = req.body?.body;
  if (typeof body !== 'string') throw new HttpError(400, 'invalid_input');
  const visit = runWithActor(req.actor, () => addOpenHouseNote(req.params.id, body));
  res.status(201).json({ visit });
}

const PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'application/octet-stream',
]);

export function addVisitPhoto(req, res) {
  const type = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!PHOTO_TYPES.has(type)) throw new HttpError(415, 'unsupported_media_type');
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'invalid_photo');
  const visit = runWithActor(req.actor, () => addOpenHousePhoto(req.params.id, req.body));
  res.status(201).json({ visit });
}

export function readVisitPhoto(req, res) {
  const photo = runWithActor(req.actor, () => readOpenHousePhoto(req.params.id, req.params.photoId));
  res.set('Content-Type', photo.contentType);
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(Buffer.from(photo.bytes));
}

export function shareListing(req, res) {
  const shared = runWithActor(req.actor, () => shareCollectedHome(req.params.id));
  res.status(201).json(shared);
}

export function joinWorkspace(req, res) {
  const token = req.body?.token;
  if (typeof token !== 'string' || token.trim().length === 0) throw new HttpError(400, 'invalid_input');
  const room = runWithActor(req.actor, () => joinWorkspaceByToken(token.trim()));
  res.json(room);
}

export function listRooms(req, res) {
  const rooms = runWithActor(req.actor, () => listSharedWorkspaces());
  res.json({ rooms });
}

export function readRoom(req, res) {
  const room = runWithActor(req.actor, () => readSharedWorkspace(req.params.id));
  res.json(room);
}

export function listMessages(req, res) {
  const messages = runWithActor(req.actor, () => listWorkspaceChat(req.params.id));
  res.json({ messages });
}

export function postMessage(req, res) {
  const body = req.body?.body;
  if (typeof body !== 'string') throw new HttpError(400, 'invalid_input');
  const messages = runWithActor(req.actor, () => postWorkspaceChat(req.params.id, body));
  res.status(201).json({ messages });
}

export function labelPhoto(req, res) {
  const photoUrl = req.body?.photoUrl;
  const room = req.body?.room;
  if (typeof photoUrl !== 'string') throw new HttpError(400, 'invalid_input');
  if (room != null && typeof room !== 'string') throw new HttpError(400, 'invalid_input');
  const photoLabels = runWithActor(req.actor, () => setPhotoLabel(req.params.id, photoUrl, room ?? ''));
  res.json({ photoLabels });
}

export function updateProfile(req, res) {
  const displayName = req.body?.displayName;
  if (typeof displayName !== 'string') throw new HttpError(400, 'invalid_input');
  const profile = runWithActor(req.actor, () => updateOwnDisplayName(displayName));
  res.json({ profile });
}

export function buyerPlaceholder() {
  throw new HttpError(501, 'not_implemented');
}
