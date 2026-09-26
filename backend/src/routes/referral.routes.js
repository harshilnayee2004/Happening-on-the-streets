import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { referralPlaceholder } from '../controllers/referral.controller.js';

const router = Router();

router.use(asyncHandler(referralPlaceholder));

export default router;
