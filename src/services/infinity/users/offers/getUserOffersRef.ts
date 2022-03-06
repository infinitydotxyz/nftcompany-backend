import { DEFAULT_MAX_ETH, fstrCnstnts } from '@base/constants';
import { OrderDirection } from '@infinityxyz/types/core';
import { error, log } from '@utils/logger';
import { getUserInfoRef } from '../getUser';
import { firestore } from '@base/container';
import { getOrdersResponseFromArray } from '@services/infinity/utils';

export function getUserOffersRef(userAddress: string) {
  return getUserInfoRef(userAddress).collection(fstrCnstnts.OFFERS_COLL);
}

export async function getFilteredUserOffersMade(
  user: string,
  chainId: string,
  priceMin: number,
  priceMax: number,
  sortByPriceDirection: OrderDirection,
  startAfterBlueCheck: string,
  startAfterPrice: number,
  startAfterMillis: number,
  limit: number,
  traitType: string,
  traitValue: string,
  collectionIds?: string
) {
  try {
    log('Getting filtered offers made by a user');

    // let startAfterBlueCheckBool = true;
    // if (startAfterBlueCheck !== undefined) {
    //   startAfterBlueCheckBool = startAfterBlueCheck === 'true';
    // }

    const runQuery = async ({
      startAfterPrice,
      startAfterMillis,
      limit
    }: {
      startAfterPrice: number;
      startAfterMillis: number;
      limit: number;
    }) => {
      let queryRef = firestore.db
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.OFFERS_COLL)
        .where('metadata.chainId', '==', chainId)
        .where('metadata.basePriceInEth', '>=', +priceMin)
        .where('metadata.basePriceInEth', '<=', +priceMax);

      if (collectionIds) {
        const collectionIdsArr = collectionIds.split(',');
        if (collectionIdsArr.length > 1) {
          queryRef = queryRef.where('metadata.asset.address', 'in', collectionIdsArr);
        } else {
          queryRef = queryRef.where('metadata.asset.address', '==', collectionIds); // match 1 id only.
        }
      }

      queryRef = queryRef
        .orderBy('metadata.basePriceInEth', sortByPriceDirection)
        .orderBy('metadata.createdAt', OrderDirection.Descending)
        .startAfter(startAfterPrice, startAfterMillis)
        .limit(limit);

      return await queryRef.get();
    };

    let data = await runQuery({ startAfterPrice, startAfterMillis, limit });
    let results = data.docs;
    if (data.size < limit) {
      const newStartAfterPrice = sortByPriceDirection === OrderDirection.Ascending ? 0 : DEFAULT_MAX_ETH;
      const newLimit = limit - data.size;
      data = await runQuery({
        startAfterPrice: newStartAfterPrice,
        startAfterMillis: Date.now(),
        limit: newLimit
      });
      results = results.concat(data.docs);
    }

    return getOrdersResponseFromArray(results);
  } catch (err) {
    error('Failed to get filtered user offers made for', user);
    error(err);
  }
}

export async function getFilteredUserOffersReceived(
  user: string,
  chainId: string,
  priceMin: number,
  priceMax: number,
  sortByPriceDirection: OrderDirection,
  startAfterBlueCheck: string,
  startAfterPrice: number,
  startAfterMillis: number,
  limit: number,
  traitType: string,
  traitValue: string,
  collectionIds?: string
) {
  try {
    log('Getting filtered offers received by a user');

    const runQuery = async ({
      startAfterPrice,
      startAfterMillis,
      limit
    }: {
      startAfterPrice: number;
      startAfterMillis: number;
      limit: number;
    }) => {
      let queryRef = firestore.db
        .collectionGroup(fstrCnstnts.OFFERS_COLL)
        .where('metadata.asset.owner', '==', user)
        .where('metadata.chainId', '==', chainId)
        .where('metadata.basePriceInEth', '>=', +priceMin)
        .where('metadata.basePriceInEth', '<=', +priceMax);

      if (collectionIds) {
        const collectionIdsArr = collectionIds.split(',');
        if (collectionIdsArr.length > 1) {
          queryRef = queryRef.where('metadata.asset.address', 'in', collectionIdsArr);
        } else {
          queryRef = queryRef.where('metadata.asset.address', '==', collectionIds); // match 1 id only.
        }
      }

      queryRef = queryRef
        .orderBy('metadata.basePriceInEth', sortByPriceDirection)
        .orderBy('metadata.createdAt', OrderDirection.Descending)
        .startAfter(startAfterPrice, startAfterMillis)
        .limit(limit);

      return await queryRef.get();
    };

    let data = await runQuery({ startAfterPrice, startAfterMillis, limit });
    let results = data.docs;
    if (data.size < limit) {
      const newStartAfterPrice = sortByPriceDirection === OrderDirection.Ascending ? 0 : DEFAULT_MAX_ETH;
      const newLimit = limit - data.size;
      data = await runQuery({
        startAfterPrice: newStartAfterPrice,
        startAfterMillis: Date.now(),
        limit: newLimit
      });
      results = results.concat(data.docs);
    }

    return getOrdersResponseFromArray(results);
  } catch (err) {
    error('Failed to get filtered user offers received for', user);
    error(err);
  }
}
