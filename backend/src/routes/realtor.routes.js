import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireActor } from '../middleware/auth.js';
import {
  createRealtorWorkspace,
  realtorAccount,
  realtorAnalytics,
  realtorDashboard,
  saveShowcase,
  updateRealtorAccount,
} from '../controllers/realtor.controller.js';

const router = Router();

router.post('/workspaces', requireActor, asyncHandler(createRealtorWorkspace));
router.get('/dashboard', requireActor, asyncHandler(realtorDashboard));
router.get('/account', requireActor, asyncHandler(realtorAccount));
router.put('/account', requireActor, asyncHandler(updateRealtorAccount));
router.get('/workspaces/:id/analytics', requireActor, asyncHandler(realtorAnalytics));
router.put('/workspaces/:id/showcase', requireActor, asyncHandler(saveShowcase));

export default router;
