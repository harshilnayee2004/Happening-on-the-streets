import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireActor } from '../middleware/auth.js';
import { createRealtorWorkspace, realtorDashboard } from '../controllers/realtor.controller.js';

const router = Router();

router.post('/workspaces', requireActor, asyncHandler(createRealtorWorkspace));
router.get('/dashboard', requireActor, asyncHandler(realtorDashboard));

export default router;
