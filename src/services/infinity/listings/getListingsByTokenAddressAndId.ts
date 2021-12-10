import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { checkOwnershipChange } from '@services/ethereum/checkOwnershipChange';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { fetchAssetAsListingFromDb } from '../assets/getAssetsAsListings';
import { deleteExpiredOrder } from '../orders/deleteExpiredOrder';
import { isOrderExpired } from '../utils';

export async function getListingByTokenAddressAndId(
  chainId: string,
  tokenId: string,
  tokenAddress: string,
  limit: number
) {
  log('Getting listings of token id and token address');
  try {
    let resp = '';
    const snapshot = await firestore.db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.asset.address', '==', tokenAddress)
      .limit(limit)
      .get();

    if (snapshot.docs.length === 0) {
      // get from db
      resp = await fetchAssetAsListingFromDb(chainId, tokenId, tokenAddress, limit);
    } else {
      resp = getOrdersResponse(snapshot);
    }
    return resp;
  } catch (err) {
    error('Failed to get listing by tokend address and id', tokenAddress, tokenId);
    error(err);
  }
}

function getOrdersResponse(data: any) {
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
