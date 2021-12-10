import { checkOwnershipChange } from '@services/ethereum/checkOwnershipChange';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { deleteExpiredOrder } from './orders/deleteExpiredOrder';

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

export function getOrdersResponse(data: any) {
  return getOrdersResponseFromArray(data.docs);
}

export function getOrdersResponseFromArray(docs: any) {
  const listings = [];
  for (const doc of docs) {
    const listing = doc.data();
    const isExpired = isOrderExpired(doc);
    try {
      checkOwnershipChange(doc);
    } catch (err) {
      error('Error checking ownership change info', err);
    }
    if (!isExpired) {
      listing.id = doc.id;
      listings.push(listing);
    } else {
      deleteExpiredOrder(doc);
    }
  }
  const resp = {
    count: listings.length,
    listings
  };
  return jsonString(resp);
}
