import { runWithActor } from '../middleware/rls.js';
import { createProperty, shareCollectedHome } from './dataAccess.js';
import { parseListing } from './listingParser.js';

function toPropertyInput(listing) {
  return {
    address: listing.address,
    title: listing.title,
    listingUrl: listing.sourceUrl,
    priceCents: listing.priceCents,
    photoUrls: listing.photos,
    beds: listing.bedrooms,
    baths: listing.bathrooms,
    sqft: listing.sqft,
    latitude: listing.latitude,
    longitude: listing.longitude,
  };
}

export async function importListingForActor(actor, rawUrl, options) {
  const listing = await parseListing(rawUrl, options);
  return runWithActor(actor, () => createProperty(toPropertyInput(listing)));
}

export async function createRealtorWorkspaceForActor(actor, rawUrl, options) {
  const property = await importListingForActor(actor, rawUrl, options);
  return runWithActor(actor, () => shareCollectedHome(property.id));
}
