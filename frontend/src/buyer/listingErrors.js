const MESSAGES = {
  host_not_allowed: 'Use an https link on zillow.com or realtor.com.',
  invalid_url: 'Paste a full https listing link.',
  blocked_address: 'That link cannot be imported.',
  redirect_not_allowed: 'That link redirected, so the home was not saved.',
  response_too_large: 'That listing page was too large to read.',
  listing_timeout: 'The listing site took too long to respond.',
  parse_failed: 'Hapstr could not find the home details on that page.',
  listing_unavailable: 'The listing site did not return the page.',
  listing_rate_limited: 'Realtor.com or Zillow blocked this import (too many requests). Wait a minute, or paste a Zillow link for the same address.',
  unauthenticated: 'Start again as a guest, then paste the link.',
};

export function listingErrorMessage(code) {
  return MESSAGES[code] || 'The home could not be saved.';
}

export function listingErrorFromAxios(err) {
  const code = err?.response?.data?.error;
  if (code) return listingErrorMessage(code);
  if (!err?.response) return listingErrorMessage('listing_timeout');
  return listingErrorMessage();
}
