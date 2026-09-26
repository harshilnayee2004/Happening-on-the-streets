import { HttpError } from '../utils/httpError.js';

export function referralPlaceholder() {
  throw new HttpError(501, 'not_implemented');
}
