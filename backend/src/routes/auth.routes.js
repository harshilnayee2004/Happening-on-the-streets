import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authPlaceholder, issueGuest, me } from '../controllers/auth.controller.js';

const router = Router();

router.post('/guest', asyncHandler(issueGuest));
router.get('/me', asyncHandler(me));
router.use(asyncHandler(authPlaceholder));

export default router;
