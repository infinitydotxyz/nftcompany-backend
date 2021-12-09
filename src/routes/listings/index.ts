import { ListingType, OrderSide } from '@base/types/NftInterface';
import { StatusCode } from '@base/types/StatusCode';
import {
  DEFAULT_ITEMS_PER_PAGE,
  DEFAULT_MAX_ETH,
  DEFAULT_MIN_ETH,
  fstrCnstnts,
  DEFAULT_PRICE_SORT_DIRECTION
} from '@constants';
import { parseQueryFields } from '@utils/parsers.js';
import { error, log } from '@utils/logger.js';
import { Router } from 'express';
import { firestore } from '@base/container';
import { fetchAssetFromOpensea } from '@routes/opensea';
import axios from 'axios';
import { getEndCode, getSearchFriendlyString, jsonString } from '@utils/formatters';
import { checkERC1155Ownership, checkERC721Ownership } from '@services/ethereum/checkTokenOwnership';
import firebaseAdmin from 'firebase-admin';
import { OrderDirection } from '@base/types/Queries';
import { isTokenVerified } from '@routes/token';
import importListings from './import';

const router = Router();

router.use('/import', importListings);

// fetch listings (for Explore page)
/*
- supports the following queries - from most to least restrictive
- supports tokenId and tokenAddress query
- supports collectionName, priceMin and priceMax query ordered by price
- supports all listings
- support title
*/
router.get('/', async (req, res) => {
  const { tokenId, listType, traitType, traitValue, collectionIds } = req.query;
  let { chainId } = req.query;
  if (!chainId) {
    chainId = '1'; // default eth mainnet
  }
  // @ts-ignore
  const tokenAddress = (req.query.tokenAddress || '').trim().toLowerCase();
  // @ts-ignore
  const collectionName = (req.query.collectionName || '').trim(); // preserve case
  // @ts-ignore
  const text = (req.query.text || '').trim(); // preserve case
  // @ts-ignore
  const startAfterSearchTitle = (req.query.startAfterSearchTitle || '').trim();
  const startAfterBlueCheck = req.query.startAfterBlueCheck;
  // @ts-ignore
  const startAfterSearchCollectionName = (req.query.startAfterSearchCollectionName || '').trim();
  // @ts-ignore

  let priceMin = +(req.query.priceMin || 0);
  let priceMax = +(req.query.priceMax || 0);
  // @ts-ignore
  const sortByPriceDirection = (req.query.sortByPrice || '').trim().toLowerCase() || DEFAULT_PRICE_SORT_DIRECTION;
  const {
    limit,
    startAfterPrice,
    startAfterMillis,
    error: err
  } = parseQueryFields(
    res,
    req,
    ['limit', 'startAfterPrice', 'startAfterMillis'],
    [`${DEFAULT_ITEMS_PER_PAGE}`, sortByPriceDirection === 'asc' ? '0' : `${DEFAULT_MAX_ETH}`, `${Date.now()}`]
  ) as { limit?: number; startAfterPrice?: number; startAfterMillis?: number; error?: Error };
  if (err) {
    return;
  }

  if (
    listType &&
    listType !== ListingType.FixedPrice &&
    listType !== ListingType.DutchAuction &&
    listType !== ListingType.EnglishAuction
  ) {
    error('Input error - invalid list type');
    res.sendStatus(StatusCode.InternalServerError);
    return;
  }

  let resp;
  if (tokenAddress && tokenId) {
    resp = await getListingByTokenAddressAndId(chainId as string, tokenId as string, tokenAddress, limit);
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  } else if (text) {
    resp = await getListingsStartingWithText(
      text,
      limit,
      startAfterSearchTitle,
      startAfterSearchCollectionName,
      startAfterMillis,
      startAfterPrice,
      sortByPriceDirection
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  } else if (collectionName || priceMin || priceMax || listType || collectionIds) {
    if (!priceMin) {
      priceMin = DEFAULT_MIN_ETH;
    }
    if (!priceMax) {
      priceMax = DEFAULT_MAX_ETH;
    }
    resp = await getListingsByCollectionNameAndPrice(
      collectionName,
      priceMin,
      priceMax,
      sortByPriceDirection,
      startAfterBlueCheck as string,
      startAfterPrice,
      startAfterMillis,
      limit,
      listType as ListingType,
      traitType as string,
      traitValue as string,
      collectionIds as string
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  } else {
    resp = await getListingsByCollection(startAfterBlueCheck as string, startAfterSearchCollectionName, limit);
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  }

  if (resp) {
    res.send(resp);
  } else {
    res.sendStatus(500);
  }
});

export default router;

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

export async function fetchAssetAsListingFromDb(chainId: string, tokenId: string, tokenAddress: string, limit: number) {
  log('Getting asset as listing from db');
  try {
    let resp = '';
    const docId = firestore.getAssetDocId({ chainId, tokenId, tokenAddress });
    const doc = await firestore.db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(docId)
      .get();

    if (!doc.exists) {
      if (chainId === '1') {
        // get from opensea
        resp = await fetchAssetFromOpensea(chainId, tokenId, tokenAddress);
      } else if (chainId === '137') {
        // get from covalent
        resp = await fetchAssetFromCovalent(chainId, tokenId, tokenAddress);
      }
    } else {
      resp = await getAssetAsListing(docId, doc.data());
    }
    return resp;
  } catch (err) {
    error('Failed to get asset from db', tokenAddress, tokenId);
    error(err);
  }
}

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

function getOrdersResponse(data: any) {
  return getOrdersResponseFromArray(data.docs);
}

function isOrderExpired(doc: any) {
  const order = doc.data();
  const utcSecondsSinceEpoch = Math.round(Date.now() / 1000);
  const orderExpirationTime = +order.expirationTime;
  if (orderExpirationTime === 0) {
    // special case of never expire
    return false;
  }
  return orderExpirationTime <= utcSecondsSinceEpoch;
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

export async function checkOwnershipChange(doc: any) {
  const order = doc.data();
  const side = order.side;
  const schema = order.metadata.schema;
  const address = order.metadata.asset.address;
  const id = order.metadata.asset.id;
  const chainId = order.metadata.chainId;
  if (side === 1) {
    // listing
    const maker = order.maker;
    if (schema && schema.trim().toLowerCase() === 'erc721') {
      checkERC721Ownership(doc, chainId, maker, address, id);
    } else if (schema && schema.trim().toLowerCase() === 'erc1155') {
      checkERC1155Ownership(doc, chainId, maker, address, id);
    }
  } else if (side === 0) {
    // offer
    const owner = order.metadata.asset.owner;
    if (schema && schema.trim().toLowerCase() === 'erc721') {
      checkERC721Ownership(doc, chainId, owner, address, id);
    } else if (schema && schema.trim().toLowerCase() === 'erc1155') {
      checkERC1155Ownership(doc, chainId, owner, address, id);
    }
  }
}

export async function getListingsByCollection(
  startAfterBlueCheck: boolean | string,
  startAfterSearchCollectionName: boolean,
  limit: number
) {
  try {
    let startAfterBlueCheckBool = true;
    if (startAfterBlueCheck !== undefined) {
      startAfterBlueCheckBool = startAfterBlueCheck === 'true';
    }

    const snapshot = await firestore.db
      .collectionGroup(fstrCnstnts.COLLECTION_LISTINGS_COLL)
      .orderBy('metadata.hasBlueCheck', 'desc')
      .orderBy('metadata.asset.searchCollectionName', 'asc')
      .startAfter(startAfterBlueCheckBool, startAfterSearchCollectionName)
      .limit(limit)
      .get();

    return getOrdersResponse(snapshot);
  } catch (err) {
    error('Failed to get listings by collection from firestore');
    error(err);
  }
}

export async function deleteExpiredOrder(doc: any) {
  log('Deleting expired order', doc.id);
  const order = doc.data();
  const side = +order.side;
  const batch = firestore.db.batch();
  if (side === 1) {
    // listing
    await deleteListing(batch, doc.ref);
  } else if (side === 0) {
    // offer
    await deleteOffer(batch, doc.ref);
  } else {
    error('Unknown order type', doc.id);
  }
  // commit batch
  log('Committing delete expired order batch');
  batch
    .commit()
    .then((resp) => {
      // no op
    })
    .catch((err) => {
      error('Failed to commit delete expired order batch');
      error(err);
    });
}

export async function deleteOffer(batch: any, docRef: any) {
  const doc = await docRef.get();
  if (!doc.exists) {
    log('No offer to delete: ' + docRef.id);
    return;
  }
  const offer = doc.id;
  log('Deleting offer', offer);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  // delete offer
  batch.delete(doc.ref);

  // update num user offers
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 0);
}

export function updateNumOrders(batch: any, user: string, numOrders: number, hasBonus: boolean, side: OrderSide) {
  log('Updating user stats');

  const ref = firestore.db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  if (side === 0) {
    // offers
    batch.set(ref, { numOffers: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
    if (hasBonus) {
      batch.set(ref, { numBonusOffers: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
    }
  } else if (side === 1) {
    // listings
    batch.set(ref, { numListings: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
    if (hasBonus) {
      batch.set(ref, { numBonusListings: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
    }
  }
}

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

    const runQuery = ({
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
        let traitQueryArr = [];
        if (traitType.indexOf(',') > 0) {
          // multi-trait query
          const typesArr = traitType.split(',');
          const valuesArr = traitValue.split(',');
          if (typesArr.length === valuesArr.length) {
            for (let j = 0; j < typesArr.length; j++) {
              traitQueryArr.push({
                traitType: typesArr[j],
                traitValue: valuesArr[j]
              });
            }
          }
        } else {
          // single-trait query
          traitQueryArr = [
            {
              traitType,
              traitValue
            }
          ];
        }
        queryRef = queryRef.where('metadata.asset.traits', 'array-contains-any', traitQueryArr);
      }

      queryRef = queryRef
        .orderBy('metadata.basePriceInEth', sortByPriceDirection)
        .orderBy('metadata.createdAt', 'desc')
        .startAfter(startAfterPrice, startAfterMillis)
        .limit(limit);

      return queryRef.get();
    };

    let data = await runQuery({ hasBlueCheckValue: startAfterBlueCheckBool, startAfterPrice, startAfterMillis, limit });
    let results = data.docs;
    if (data.size < limit) {
      const newStartAfterPrice = sortByPriceDirection === 'asc' ? 0 : DEFAULT_MAX_ETH;
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

export async function fetchAssetFromCovalent(chainId: string, tokenId: string, tokenAddress: string) {
  log('Getting asset from Covalent');
  const apiBase = 'https://api.covalenthq.com/v1/';
  const authKey = process.env.covalentKey;
  const url = apiBase + chainId + '/tokens/' + tokenAddress + '/nft_metadata/' + tokenId + '/&key=' + authKey;
  try {
    const { data } = await axios.get(url);
    const items = data.data.items;
    if (items.length > 0) {
      // save in db for future use
      return await saveRawCovalentAssetInDatabase(chainId, items[0]);
    } else {
      return '';
    }
  } catch (err) {
    error('Error occured while fetching assets from covalent');
    error(err);
  }
}

export async function saveRawCovalentAssetInDatabase(chainId: string, rawAssetData: any) {
  try {
    const assetData: any = {};
    const marshalledData = await covalentAssetDataToListing(chainId, rawAssetData);
    assetData.metadata = marshalledData;
    assetData.rawData = rawAssetData;

    const tokenAddress = marshalledData.asset.address.toLowerCase();
    const tokenId = marshalledData.asset.id;
    const newDoc = firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(firestore.getAssetDocId({ tokenAddress, tokenId, chainId }));
    await newDoc.set(assetData);
    return getAssetAsListing(newDoc.id, assetData);
  } catch (err) {
    error('Error occured while saving asset data in database');
    error(err);
  }
}

export async function covalentAssetDataToListing(chainId: string, data: any) {
  const address = data.contract_address;
  const collectionName = data.contract_name;
  let id = '';
  let title = '';
  let schema = '';
  let description = '';
  let image = '';
  let imagePreview = '';
  let numTraits = 0;
  const traits = [];
  const nftData = data.nft_data;
  if (nftData && nftData.length > 0) {
    const firstNftData = nftData[0];
    id = firstNftData.token_id;
    for (const std of firstNftData.supports_erc) {
      if (std.trim().toLowerCase() === 'erc721') {
        schema = 'ERC721';
      } else if (std.trim().toLowerCase() === 'erc1155') {
        schema = 'ERC1155';
      }
    }
    const externalData = firstNftData.external_data;
    if (externalData) {
      title = externalData.name;
      description = externalData.description;
      image = externalData.image;
      imagePreview = externalData.image_512;
      const attrs = externalData.attributes;
      if (attrs && attrs.length > 0) {
        for (const attr of attrs) {
          numTraits++;
          traits.push({ traitType: attr.trait_type, traitValue: String(attr.value) });
        }
      }
    }
  }
  const listing = {
    isListing: false,
    hasBlueCheck: await isTokenVerified(address),
    schema,
    chainId,
    asset: {
      address,
      id,
      collectionName,
      description,
      image,
      imagePreview,
      searchCollectionName: getSearchFriendlyString(collectionName),
      searchTitle: getSearchFriendlyString(title),
      title,
      numTraits,
      traits
    }
  };
  return listing;
}

export async function deleteListing(batch: any, docRef: any) {
  const doc = await docRef.get();
  if (!doc.exists) {
    log('No listing to delete: ' + docRef.id);
    return;
  }
  const listing = doc.id;
  log('Deleting listing', listing);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  // delete listing
  batch.delete(doc.ref);

  // update num collection listings
  try {
    const tokenAddress = doc.data().metadata.asset.address;
    firestore
      .collection(fstrCnstnts.COLLECTION_LISTINGS_COLL)
      .doc(tokenAddress)
      .set({ numListings: firebaseAdmin.firestore.FieldValue.increment(-1 * numOrders) }, { merge: true });
  } catch (err) {
    error('Error updating root collection data on delete listing');
    error(err);
  }
  // update num user listings
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 1);
}

// eslint-disable-next-line no-unused-vars
export async function getAllListings(
  sortByPriceDirection: OrderDirection,
  startAfterPrice: string,
  startAfterMillis: string,
  startAfterBlueCheck: string,
  limit: number
) {
  log('Getting all listings');

  try {
    let query = firestore.db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .orderBy('metadata.hasBlueCheck', 'desc')
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', 'desc');

    if (startAfterBlueCheck === undefined) {
      query = query.startAfter(true, startAfterPrice, startAfterMillis);
    } else {
      const startAfterBlueCheckBool = startAfterBlueCheck === 'true';
      query = query.startAfter(startAfterBlueCheckBool, startAfterPrice, startAfterMillis);
    }

    const data = await query.limit(limit).get();

    return getOrdersResponse(data);
  } catch (err) {
    error('Failed to get listings');
    error(err);
  }
}
