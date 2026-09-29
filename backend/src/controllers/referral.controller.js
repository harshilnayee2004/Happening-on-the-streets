import { HttpError } from '../utils/httpError.js';
import { runWithActor } from '../middleware/rls.js';
import {
  createReferral,
  explainReferralMatch,
  listReferrals,
  searchReferrals,
  unlockReferral,
} from '../services/dataAccess.js';

export function submitReferral(req, res) {
  const referral = runWithActor(req.actor, () => createReferral(req.body || {}));
  res.status(201).json({ referral });
}

export function myReferrals(req, res) {
  const referrals = runWithActor(req.actor, () => listReferrals());
  res.json({ referrals });
}

export function findReferrals(req, res) {
  const scope = req.query?.scope === 'beyond' ? 'beyond' : 'network';
  const query = typeof req.query?.q === 'string' ? req.query.q : '';
  const payload = runWithActor(req.actor, () => searchReferrals({ query, scope }));
  res.json(payload);
}

export function matchReferral(req, res) {
  const leadId = req.body?.leadId;
  const candidateId = req.body?.candidateId;
  if (typeof leadId !== 'string' || typeof candidateId !== 'string') {
    throw new HttpError(400, 'invalid_input');
  }
  const match = runWithActor(req.actor, () => explainReferralMatch(leadId, candidateId));
  res.json({ match });
}

export function unlockReferralContact(_req, _res) {
  unlockReferral();
}

export function referralPlaceholder() {
  throw new HttpError(501, 'not_implemented');
}
