import { HttpError } from '../utils/httpError.js';
import { runWithActor } from '../middleware/rls.js';
import { listRealtorDashboard } from '../services/dataAccess.js';
import { createRealtorWorkspaceForActor } from '../services/collectListings.js';

export async function createRealtorWorkspace(req, res) {
  const url = req.body?.url;
  if (typeof url !== 'string' || url.trim().length === 0) throw new HttpError(400, 'invalid_input');
  const created = await createRealtorWorkspaceForActor(req.actor, url.trim());
  res.status(201).json(created);
}

export function realtorDashboard(req, res) {
  const listings = runWithActor(req.actor, () => listRealtorDashboard());
  res.json({ listings });
}
