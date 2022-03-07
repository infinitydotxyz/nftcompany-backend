import { firestore } from 'container';
import { ListingType, OrderDirection } from '@infinityxyz/types/core';
import { DEFAULT_MAX_ETH, fstrCnstnts } from '../../../constants';
import { getEndCode, getSearchFriendlyString } from 'utils/formatters';
import { error, log } from 'utils/logger';
import { getOrdersResponse, getOrdersResponseFromArray } from '../utils';

export async function getListingsStartingWithText(
  text: string,
  limit: number,
  startAfterSearchTitle?: boolean,
  startAfterSearchCollectionName?: boolean,
  startAfterMillis?: number,
  startAfterPrice?: number,
  sortByPriceDirection?: OrderDirection
) {
  try {
    log('Getting listings starting with text:', text);

    // search for listings which title startsWith text
    const startsWith = getSearchFriendlyString(text);
    const limit1 = Math.ceil(limit / 2);
    const limit2 = limit - limit1;

    const queryRef1 = firestore.db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchTitle', '>=', startsWith)
      .where('metadata.asset.searchTitle', '<', getEndCode(startsWith))
      .orderBy('metadata.asset.searchTitle', OrderDirection.Ascending)
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', OrderDirection.Descending)
      .startAfter(startAfterSearchTitle, startAfterPrice, startAfterMillis)
      .limit(limit1);
    const resultByTitle = await queryRef1.get();

    // search for listings which collectionName startsWith text
    const queryRef2 = firestore.db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchCollectionName', '>=', startsWith)
      .where('metadata.asset.searchCollectionName', '<', getEndCode(startsWith))
      .orderBy('metadata.asset.searchCollectionName', OrderDirection.Ascending)
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', OrderDirection.Descending)
      .startAfter(startAfterSearchCollectionName, startAfterPrice, startAfterMillis)
      .limit(limit2);
    const resultByCollectionName = await queryRef2.get();

    // combine both results:
    return getOrdersResponse({ docs: [...resultByCollectionName.docs, ...resultByTitle.docs] });
  } catch (err) {
    error('Failed to get listings by text, limit, startAfterMillis', text, limit, startAfterMillis);
    error(err);
  }
}

export async function getListingsByCollectionNameAndPrice(
  collectionName: string,
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
    log('Getting listings of a collection');

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
        .collectionGroup(fstrCnstnts.LISTINGS_COLL)
        .where('metadata.hasBlueCheck', '==', hasBlueCheckValue)
        .where('metadata.basePriceInEth', '>=', +priceMin)
        .where('metadata.basePriceInEth', '<=', +priceMax);

      if (listingType) {
        queryRef = queryRef.where('metadata.listingType', '==', listingType);
      }

      if (collectionName) {
        queryRef = queryRef.where('metadata.asset.searchCollectionName', '==', getSearchFriendlyString(collectionName));
      }

      if (collectionIds) {
        const collectionIdsArr = collectionIds.split(',');
        if (collectionIdsArr.length > 1) {
          queryRef = queryRef.where('metadata.asset.address', 'in', collectionIdsArr);
        } else {
          queryRef = queryRef.where('metadata.asset.address', '==', collectionIds); // match 1 id only.
        }
      }

      if (traitType && traitValue) {
        const traitQueryArr: any[] = [];
        if (traitType.indexOf(',') > 0) {
          // multi-trait query
          const typesArr = traitType.split(',');
          const valuesArr = traitValue.split(',');
          if (typesArr.length === valuesArr.length) {
            for (let j = 0; j < typesArr.length; j++) {
              const valArr = valuesArr[j].split('|'); // valuesArr[j] may contain multiple values like: Blue|White
              for (let v = 0; v < typesArr.length; v++) {
                traitQueryArr.push({
                  traitType: typesArr[j],
                  traitValue: valArr[v]
                });
              }
            }
          }
        } else {
          // single-trait query
          const valArr = traitValue.split('|'); // valuesArr[j] may contain multiple values like: Blue|White
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
  } catch (err) {
    error('Failed to get listings by collection name, priceMin and priceMax', collectionName, priceMin, priceMax);
    error(err);
  }
}
