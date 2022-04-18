import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { error, log } from '@infinityxyz/lib/utils';
import { fetchAssetAsListingFromDb } from '../assets/getAssetsAsListings';
import { getOrdersResponse } from '../utils';

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
      // Get from db
      const listing = await fetchAssetAsListingFromDb(chainId, tokenId, tokenAddress, limit);
      resp = listing ?? '';
    } else {
      resp = getOrdersResponse(snapshot);
    }
    return resp;
  } catch (err: any) {
    error('Failed to get listing by token address and id', tokenAddress, tokenId);
    error(err);
  }
}
