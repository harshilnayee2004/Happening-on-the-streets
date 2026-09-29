import { HttpError } from '../utils/httpError.js';
import { runWithActor } from '../middleware/rls.js';
import {
  listRealtorDashboard,
  readQuestionEvidence,
  readRealtorAccount,
  readRealtorAnalytics,
  setRealtorTier,
  upsertShowcase,
} from '../services/dataAccess.js';
import { enhanceFiveQuestions } from '../services/aiQuestions.js';
import { createRealtorWorkspaceForActor } from '../services/collectListings.js';

export async function createRealtorWorkspace(req, res) {
  const url = req.body?.url;
  if (typeof url !== 'string' || url.trim().length === 0) throw new HttpError(400, 'invalid_input');
  const created = await createRealtorWorkspaceForActor(req.actor, url.trim());
  res.status(201).json(created);
}

export function realtorDashboard(req, res) {
  const payload = runWithActor(req.actor, () => ({
    tier: readRealtorAccount(req.actor.id).tier,
    listings: listRealtorDashboard(),
  }));
  res.json(payload);
}

export function realtorAccount(req, res) {
  const account = runWithActor(req.actor, () => readRealtorAccount(req.actor.id));
  res.json(account);
}

export function updateRealtorAccount(req, res) {
  const tier = req.body?.tier;
  if (typeof tier !== 'string') throw new HttpError(400, 'invalid_input');
  const account = runWithActor(req.actor, () => setRealtorTier(tier));
  res.json(account);
}

export async function realtorAnalytics(req, res) {
  const analytics = runWithActor(req.actor, () => readRealtorAnalytics(req.params.id));
  if (analytics.questions) {
    const evidence = runWithActor(req.actor, () => readQuestionEvidence(req.params.id));
    analytics.questions = await enhanceFiveQuestions(analytics.questions, evidence);
    analytics.questionsSource = process.env.OPENAI_API_KEY ? 'ai' : 'rules';
  }
  res.json(analytics);
}

export function saveShowcase(req, res) {
  const showcase = runWithActor(req.actor, () => upsertShowcase(req.params.id, {
    modelUrl: req.body?.modelUrl,
    latitude: req.body?.latitude,
    longitude: req.body?.longitude,
    rotation: req.body?.rotation,
    scale: req.body?.scale,
  }));
  res.json({ showcase });
}
