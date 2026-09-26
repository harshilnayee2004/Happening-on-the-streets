import { HttpError } from '../utils/httpError.js';

export function claimGuestAssets() {
  throw new HttpError(501, 'not_implemented');
}
