import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';

export function getAssetAsListing(docId: string, data: any) {
  log('Converting asset to listing');
  try {
    const listings = [];
    const listing = data;
    listing.id = docId;
    listings.push(listing);
    const resp = {
      count: listings.length,
      listings
    };
    return jsonString(resp);
  } catch (err) {
    error('Failed to convert asset to listing');
    error(err);
  }
}

export function isOrderExpired(doc: any) {
  const order = doc.data();
  const utcSecondsSinceEpoch = Math.round(Date.now() / 1000);
  const orderExpirationTime = +order.expirationTime;
  if (orderExpirationTime === 0) {
    // special case of never expire
    return false;
  }
  return orderExpirationTime <= utcSecondsSinceEpoch;
}
