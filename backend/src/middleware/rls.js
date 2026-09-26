import { AsyncLocalStorage } from 'node:async_hooks';
import { VISIBILITY } from '../models/WorkspaceItem.js';
import { HttpError } from '../utils/httpError.js';

const storage = new AsyncLocalStorage();
const KINDS = new Set(['user', 'guest']);

export function runWithActor(actor, fn) {
  if (!actor || typeof actor.id !== 'string' || actor.id.length === 0 || !KINDS.has(actor.kind)) {
    throw new HttpError(401, 'unauthenticated');
  }
  return storage.run({ actor: { id: actor.id, kind: actor.kind } }, fn);
}

export function getActor() {
  const actor = storage.getStore()?.actor;
  if (!actor) throw new HttpError(401, 'unauthenticated');
  return actor;
}

export function rlsMiddleware(req, _res, next) {
  if (!req.actor) return next();
  return runWithActor(req.actor, () => next());
}

export function canReadWorkspaceItem(actor, item, membershipRole, sharedWithActor) {
  if (!actor || typeof actor.id !== 'string' || !item) return false;
  if (item.createdBy === actor.id) return true;
  switch (item.visibility) {
    case VISIBILITY.PRIVATE:
      return false;
    case VISIBILITY.FAMILY:
      return membershipRole === 'family';
    case VISIBILITY.REALTOR:
      return membershipRole === 'realtor';
    case VISIBILITY.SHARED:
      return sharedWithActor === true;
    case VISIBILITY.EVERYONE:
      return typeof membershipRole === 'string' && membershipRole.length > 0;
    default:
      return false;
  }
}

export function workspaceItemVisibilityWhere(alias = 'i') {
  if (!/^[a-z]$/.test(alias)) throw new Error('Invalid SQL alias');
  return `(
    ${alias}.created_by = :actorId
    OR (${alias}.visibility = 'family' AND EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = ${alias}.workspace_id
        AND m.user_id = :actorId
        AND m.member_role = 'family'
    ))
    OR (${alias}.visibility = 'realtor' AND EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = ${alias}.workspace_id
        AND m.user_id = :actorId
        AND m.member_role = 'realtor'
    ))
    OR (${alias}.visibility = 'shared' AND EXISTS (
      SELECT 1 FROM workspace_item_shares s
      WHERE s.item_id = ${alias}.id AND s.user_id = :actorId
    ))
    OR (${alias}.visibility = 'everyone' AND EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = ${alias}.workspace_id AND m.user_id = :actorId
    ))
  )`;
}
