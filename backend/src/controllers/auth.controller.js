import { HttpError } from '../utils/httpError.js';
import { signActorToken } from '../middleware/auth.js';
import { provisionGuest } from '../services/dataAccess.js';

const GUEST_TOKEN_SECONDS = 60 * 60 * 24 * 30;

export function issueGuest(_req, res) {
  const guest = provisionGuest();
  const token = signActorToken({
    id: guest.id,
    kind: 'guest',
    expiresInSeconds: GUEST_TOKEN_SECONDS,
  });
  res.status(201).json({ token, actor: { id: guest.id, kind: guest.kind } });
}

export function me(req, res) {
  res.json({ actor: req.actor });
}

export function authPlaceholder() {
  throw new HttpError(501, 'not_implemented');
}
