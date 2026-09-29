import { Router } from 'express';
import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireActor } from '../middleware/auth.js';
import { MAX_IMAGE_BYTES } from '../utils/imageType.js';
import {
  addVisitNote,
  addVisitPhoto,
  buyerPlaceholder,
  importListing,
  joinWorkspace,
  labelPhoto,
  listListings,
  listMessages,
  listRooms,
  listVisits,
  postMessage,
  readRoom,
  updateWorkspaceConsent,
  workspaceReadiness,
  workspaceReadinessOverride,
  readDemo,
  readVisitPhoto,
  shareListing,
  startVisit,
  updateProfile,
} from '../controllers/buyer.controller.js';

const router = Router();

const imageBody = express.raw({
  limit: MAX_IMAGE_BYTES,
  type: (req) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    return type.startsWith('image/') || type === 'application/octet-stream';
  },
});

router.post('/listings', requireActor, asyncHandler(importListing));
router.get('/listings', requireActor, asyncHandler(listListings));
router.get('/demo', requireActor, asyncHandler(readDemo));
router.post('/visits', requireActor, asyncHandler(startVisit));
router.get('/visits', requireActor, asyncHandler(listVisits));
router.post('/visits/:id/notes', requireActor, asyncHandler(addVisitNote));
router.post('/visits/:id/photos', requireActor, imageBody, asyncHandler(addVisitPhoto));
router.get('/visits/:id/photos/:photoId', requireActor, asyncHandler(readVisitPhoto));
router.post('/listings/:id/share', requireActor, asyncHandler(shareListing));
router.post('/profile', requireActor, asyncHandler(updateProfile));
router.post('/workspaces/join', requireActor, asyncHandler(joinWorkspace));
router.get('/workspaces', requireActor, asyncHandler(listRooms));
router.get('/workspaces/:id', requireActor, asyncHandler(readRoom));
router.get('/workspaces/:id/messages', requireActor, asyncHandler(listMessages));
router.post('/workspaces/:id/messages', requireActor, asyncHandler(postMessage));
router.post('/workspaces/:id/photo-labels', requireActor, asyncHandler(labelPhoto));
router.post('/workspaces/:id/consent', requireActor, asyncHandler(updateWorkspaceConsent));
router.get('/workspaces/:id/readiness', requireActor, asyncHandler(workspaceReadiness));
router.post('/workspaces/:id/readiness/override', requireActor, asyncHandler(workspaceReadinessOverride));
router.use(asyncHandler(buyerPlaceholder));

export default router;
