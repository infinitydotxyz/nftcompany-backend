import { ListType, OrderSide } from '@base/types/NftInterface';
import { StatusCode } from '@base/types/StatusCode';
import { DEFAULT_ITEMS_PER_PAGE, DEFAULT_MAX_ETH, DEFAULT_MIN_ETH, fstrCnstnts } from '@constants';
import { parseQueryFields } from '@utils/parsers.js';
import { error, log } from '@utils/logger.js';
import { Router } from 'express';
import { firestore } from '@base/container';
import crypto from 'crypto';
import { fetchAssetFromOpensea } from '@routes/opensea';
import axios from 'axios';
import { jsonString } from '@utils/formatters';
import { checkERC1155Ownership, checkERC721Ownership } from '@services/ethereum/checkTokenOwnership';

const router = Router();

// fetch listings (for Explore page)
/*
- supports the following queries - from most to least restrictive
- supports tokenId and tokenAddress query
- supports collectionName, priceMin and priceMax query ordered by price
- supports all listings
- support title
*/
router.get('/listings', async (req, res) => {
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
    listType !== ListType.FixedPrice &&
    listType !== ListType.DutchAuction &&
    listType !== ListType.EnglishAuction
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
      startAfterBlueCheck,
      startAfterPrice,
      startAfterMillis,
      limit,
      listType,
      traitType,
      traitValue,
      collectionIds
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  } else {
    resp = await getListingsByCollection(startAfterBlueCheck, startAfterSearchCollectionName, limit);
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

async function getListingByTokenAddressAndId(chainId: string, tokenId: string, tokenAddress: string, limit: number) {
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

async function fetchAssetAsListingFromDb(chainId: string, tokenId: string, tokenAddress: string, limit: number) {
  log('Getting asset as listing from db');
  try {
    let resp = '';
    const docId = getAssetDocId({ chainId, tokenId, tokenAddress });
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

async function getAssetAsListing(docId: string, data: any) {
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

function getAssetDocId({ chainId, tokenId, tokenAddress }: { chainId: string; tokenId: string; tokenAddress: string }) {
  const data = tokenAddress.trim() + tokenId.trim() + chainId;
  return crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
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

function getOrdersResponseFromArray(docs: any) {
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

async function checkOwnershipChange(doc: any) {
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

async function getListingsByCollection(
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

async function deleteExpiredOrder(doc: any) {
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

async function deleteOffer(batch: any, docRef: any) {
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

function updateNumOrders(batch: any, user: string, numOrders: number | string, hasBonus: boolean, side: OrderSide) {
  utils.log('Updating user stats');

  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  if (side === 0) {
    // offers
    batch.set(ref, { numOffers: firebaseAdmin.firestore.FieldValue.increment(num) }, { merge: true });
    if (hasBonus) {
      batch.set(ref, { numBonusOffers: firebaseAdmin.firestore.FieldValue.increment(num) }, { merge: true });
    }
  } else if (side === 1) {
    // listings
    batch.set(ref, { numListings: firebaseAdmin.firestore.FieldValue.increment(num) }, { merge: true });
    if (hasBonus) {
      batch.set(ref, { numBonusListings: firebaseAdmin.firestore.FieldValue.increment(num) }, { merge: true });
    }
  }
}

async function getListingsStartingWithText(
  text,
  limit,
  startAfterSearchTitle,
  startAfterSearchCollectionName,
  startAfterMillis,
  startAfterPrice,
  sortByPriceDirection
) {
  try {
    utils.log('Getting listings starting with text:', text);

    // search for listings which title startsWith text
    const startsWith = utils.getSearchFriendlyString(text);
    const limit1 = Math.ceil(limit / 2);
    const limit2 = limit - limit1;

    const queryRef1 = db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchTitle', '>=', startsWith)
      .where('metadata.asset.searchTitle', '<', utils.getEndCode(startsWith))
      .orderBy('metadata.asset.searchTitle', 'asc')
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', 'desc')
      .startAfter(startAfterSearchTitle, startAfterPrice, startAfterMillis)
      .limit(limit1);
    const resultByTitle = await queryRef1.get();

    // search for listings which collectionName startsWith text
    const queryRef2 = db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchCollectionName', '>=', startsWith)
      .where('metadata.asset.searchCollectionName', '<', utils.getEndCode(startsWith))
      .orderBy('metadata.asset.searchCollectionName', 'asc')
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', 'desc')
      .startAfter(startAfterSearchCollectionName, startAfterPrice, startAfterMillis)
      .limit(limit2);
    const resultByCollectionName = await queryRef2.get();

    // combine both results:
    return getOrdersResponse({ docs: [...resultByCollectionName.docs, ...resultByTitle.docs] });
  } catch (err) {
    utils.error('Failed to get listings by text, limit, startAfterMillis', text, limit, startAfterMillis);
    utils.error(err);
  }
}

async function getListingsByCollectionNameAndPrice(
  collectionName,
  priceMin,
  priceMax,
  sortByPriceDirection,
  startAfterBlueCheck,
  startAfterPrice,
  startAfterMillis,
  limit,
  listType,
  traitType,
  traitValue,
  collectionIds
) {
  try {
    utils.log('Getting listings of a collection');

    let startAfterBlueCheckBool = true;
    if (startAfterBlueCheck !== undefined) {
      startAfterBlueCheckBool = startAfterBlueCheck === 'true';
    }

    const runQuery = ({ hasBlueCheckValue, startAfterPrice, startAfterMillis, limit }) => {
      let queryRef = db
        .collectionGroup(fstrCnstnts.LISTINGS_COLL)
        .where('metadata.hasBlueCheck', '==', hasBlueCheckValue)
        .where('metadata.basePriceInEth', '>=', +priceMin)
        .where('metadata.basePriceInEth', '<=', +priceMax);

      if (listType) {
        queryRef = queryRef.where('metadata.listingType', '==', listType);
      }

      if (collectionName) {
        queryRef = queryRef.where(
          'metadata.asset.searchCollectionName',
          '==',
          utils.getSearchFriendlyString(collectionName)
        );
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
    utils.error('Failed to get listings by collection name, priceMin and priceMax', collectionName, priceMin, priceMax);
    utils.error(err);
  }
}

async function fetchAssetFromCovalent(chainId: string, tokenId: string, tokenAddress: string) {
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
    utils.error('Error occured while fetching assets from covalent');
    utils.error(err);
  }
}

async function saveRawCovalentAssetInDatabase(chainId, rawAssetData) {
  try {
    const assetData = {};
    const marshalledData = await covalentAssetDataToListing(chainId, rawAssetData);
    assetData.metadata = marshalledData;
    assetData.rawData = rawAssetData;

    const tokenAddress = marshalledData.asset.address.toLowerCase();
    const tokenId = marshalledData.asset.id;
    const newDoc = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(getAssetDocId({ tokenAddress, tokenId, chainId }));
    await newDoc.set(assetData);
    return getAssetAsListing(newDoc.id, assetData);
  } catch (err) {
    utils.error('Error occured while saving asset data in database');
    utils.error(err);
  }
}

async function covalentAssetDataToListing(chainId, data) {
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
      searchCollectionName: utils.getSearchFriendlyString(collectionName),
      searchTitle: utils.getSearchFriendlyString(title),
      title,
      numTraits,
      traits
    }
  };
  return listing;
}

async function deleteListing(batch, docRef) {
  const doc = await docRef.get();
  if (!doc.exists) {
    utils.log('No listing to delete: ' + docRef.id);
    return;
  }
  const listing = doc.id;
  utils.log('Deleting listing', listing);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  // delete listing
  batch.delete(doc.ref);

  // update num collection listings
  try {
    const tokenAddress = doc.data().metadata.asset.address;
    db.collection(fstrCnstnts.COLLECTION_LISTINGS_COLL)
      .doc(tokenAddress)
      .set({ numListings: firebaseAdmin.firestore.FieldValue.increment(-1 * numOrders) }, { merge: true });
  } catch (err) {
    utils.error('Error updating root collection data on delete listing');
    utils.error(err);
  }
  // update num user listings
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 1);
}
