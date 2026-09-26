import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const KINDS = new Set(['user', 'guest']);

function signBody(body) {
  return crypto.createHmac('sha256', env.authSecret).update(body).digest('base64url');
}

export function signActorToken({ id, kind, expiresInSeconds = 60 * 60 }) {
  if (typeof id !== 'string' || id.length === 0 || !KINDS.has(kind)) {
    throw new HttpError(400, 'invalid_input');
  }
  const payload = {
    sub: id,
    kind,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signBody(body)}`;
}

export function verifyActorToken(token) {
  if (typeof token !== 'string') throw new HttpError(401, 'invalid_token');
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new HttpError(401, 'invalid_token');
  const [body, sig] = parts;
  const expected = signBody(body);
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    throw new HttpError(401, 'invalid_token');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(401, 'invalid_token');
  }
  if (!payload || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new HttpError(401, 'invalid_token');
  }
  if (!KINDS.has(payload.kind)) throw new HttpError(401, 'invalid_token');
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, 'invalid_token');
  }
  return { id: payload.sub, kind: payload.kind };
}

export function authMiddleware(req, _res, next) {
  const header = req.get('authorization');
  const guestHeader = req.get('x-guest-token');
  if (header && guestHeader) return next(new HttpError(401, 'invalid_token'));
  if (!header && !guestHeader) {
    req.actor = null;
    return next();
  }
  try {
    if (header) {
      const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header);
      if (!match) return next(new HttpError(401, 'invalid_token'));
      req.actor = verifyActorToken(match[1]);
      return next();
    }
    const actor = verifyActorToken(guestHeader);
    if (actor.kind !== 'guest') return next(new HttpError(401, 'invalid_token'));
    req.actor = actor;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireActor(req, _res, next) {
  if (!req.actor) return next(new HttpError(401, 'unauthenticated'));
  return next();
}

export function safeAppPath(value) {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > 200) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  if (value.includes('://')) return null;
  if (value.includes('\0')) return null;
  return value;
}
