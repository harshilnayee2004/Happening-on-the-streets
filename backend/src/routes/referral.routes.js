import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireActor } from '../middleware/auth.js';
import {
  findReferrals,
  matchReferral,
  myReferrals,
  referralPlaceholder,
  submitReferral,
  unlockReferralContact,
} from '../controllers/referral.controller.js';

const router = Router();

router.post('/leads', requireActor, asyncHandler(submitReferral));
router.get('/leads', requireActor, asyncHandler(myReferrals));
router.get('/search', requireActor, asyncHandler(findReferrals));
router.post('/match', requireActor, asyncHandler(matchReferral));
router.post('/unlock', requireActor, asyncHandler(unlockReferralContact));
router.use(asyncHandler(referralPlaceholder));

export default router;
