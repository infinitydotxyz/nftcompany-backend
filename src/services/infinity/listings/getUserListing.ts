import { firestore } from 'container';
import { DEFAULT_MAX_ETH, fstrCnstnts } from '../../../constants';
import { OrderDirection, ListingType } from '@infinityxyz/lib/types/core';
import { error, log } from '@infinityxyz/lib/utils';
import { getOrdersResponseFromArray } from '../utils';

export function getUserListingsRef(userAddress: string) {
  return firestore.db
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

export async function getFilteredUserListings(
  user: string,
  chainId: string,
  priceMin: number,
  priceMax: number,
  sortByPriceDirection: OrderDirection,
  startAfterBlueCheck: string,
  startAfterPrice: number,
  startAfterMillis: number,
  limit: number,
  listingType: ListingType,
  traitType: string,
  traitValue: string,
  collectionIds?: string
) {
  try {
    log('Getting filtered listings of a user');

    let startAfterBlueCheckBool = true;
    if (startAfterBlueCheck !== undefined) {
      startAfterBlueCheckBool = startAfterBlueCheck === 'true';
    }

    const runQuery = async ({
      hasBlueCheckValue,
      startAfterPrice,
      startAfterMillis,
      limit
    }: {
      hasBlueCheckValue: boolean;
      startAfterPrice: number;
      startAfterMillis: number;
      limit: number;
    }) => {
      let queryRef = firestore.db
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .where('metadata.chainId', '==', chainId)
        .where('metadata.basePriceInEth', '>=', +priceMin)
        .where('metadata.basePriceInEth', '<=', +priceMax);

      if (hasBlueCheckValue) {
        queryRef = queryRef.where('metadata.hasBlueCheck', '==', hasBlueCheckValue);
      }

      if (listingType) {
        queryRef = queryRef.where('metadata.listingType', '==', listingType);
      }

      if (collectionIds) {
        const collectionIdsArr = collectionIds.split(',');
        if (collectionIdsArr.length > 1) {
          queryRef = queryRef.where('metadata.asset.address', 'in', collectionIdsArr);
        } else {
          queryRef = queryRef.where('metadata.asset.address', '==', collectionIds); // Match 1 id only.
        }
      }

      if (traitType && traitValue) {
        const traitQueryArr: any[] = [];
        if (traitType.indexOf(',') > 0) {
          // Multi-trait query
          const typesArr = traitType.split(',');
          const valuesArr = traitValue.split(',');
          if (typesArr.length === valuesArr.length) {
            for (let j = 0; j < typesArr.length; j++) {
              const valArr = valuesArr[j].split('|'); // ValuesArr[j] may contain multiple values like: Blue|White
              for (let v = 0; v < typesArr.length; v++) {
                traitQueryArr.push({
                  traitType: typesArr[j],
                  traitValue: valArr[v]
                });
              }
            }
          }
        } else {
          // Single-trait query
          const valArr = traitValue.split('|'); // ValuesArr[j] may contain multiple values like: Blue|White
          for (let v = 0; v < valArr.length; v++) {
            traitQueryArr.push({
              traitType,
              traitValue: valArr[v]
            });
          }
        }
        queryRef = queryRef.where('metadata.asset.traits', 'array-contains-any', traitQueryArr);
      }

      queryRef = queryRef
        .orderBy('metadata.basePriceInEth', sortByPriceDirection)
        .orderBy('metadata.createdAt', OrderDirection.Descending)
        .startAfter(startAfterPrice, startAfterMillis)
        .limit(limit);

      return await queryRef.get();
    };

    let data = await runQuery({ hasBlueCheckValue: startAfterBlueCheckBool, startAfterPrice, startAfterMillis, limit });
    let results = data.docs;
    if (data.size < limit) {
      const newStartAfterPrice = sortByPriceDirection === OrderDirection.Ascending ? 0 : DEFAULT_MAX_ETH;
      const newLimit = limit - data.size;
      data = await runQuery({
        hasBlueCheckValue: false,
        startAfterPrice: newStartAfterPrice,
        startAfterMillis: Date.now(),
        limit: newLimit
      });
      results = results.concat(data.docs);
    }

    return getOrdersResponseFromArray(results);
  } catch (err: any) {
    error('Failed to get filtered user listings for', user);
    error(err);
  }
}
