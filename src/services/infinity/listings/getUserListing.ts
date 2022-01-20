import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';

export function getUserListingsRef(userAddress: string) {
  return firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(userAddress)
    .collection(fstrCnstnts.LISTINGS_COLL);
}

export function getUserListingRef(
  userAddress: string,
  listingData: { tokenAddress: string; tokenId: string; basePrice: string }
) {
  const listingDocId = firestore.getDocId({
    tokenAddress: listingData.tokenAddress,
    tokenId: listingData.tokenId,
    basePrice: listingData.basePrice
  });
  return getUserListingsRef(userAddress).doc(listingDocId);
}
