require('dotenv').config();
const { ethers } = require('ethers');
const ethersProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet); // polymain

const BigNumber = require('bignumber.js');
const express = require('express');
const helmet = require('helmet');
const axios = require('axios').default;
const qs = require('qs');
const crypto = require('crypto');
const utils = require('./utils');
const types = require('./types');
const erc721Abi = require('./abi/erc721.json');
const erc1155Abi = require('./abi/erc1155.json');

const app = express();
const cors = require('cors');
app.use(express.json());
app.use(cors());
app.use(helmet());

const constants = require('./constants');
const fstrCnstnts = constants.firestore;

const firebaseAdmin = utils.getFirebaseAdmin();
const db = firebaseAdmin.firestore();

const nftDataSources = {
  0: 'nftc',
  1: 'opensea',
  2: 'unmarshal',
  3: 'alchemy',
  4: 'covalent'
};
const DEFAULT_ITEMS_PER_PAGE = 50;
const DEFAULT_MIN_ETH = 0.0000001;
const DEFAULT_MAX_ETH = 1000000; // for listings
const DEFAULT_PRICE_SORT_DIRECTION = 'desc';

// init server
const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
  utils.log(`Server listening on port ${PORT}...`);
});

app.all('/u/*', async (req, res, next) => {
  const authorized = await utils.authorizeUser(
    req.path,
    req.header(constants.auth.signature),
    req.header(constants.auth.message)
  );
  if (authorized) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
});

// ================================================ GETS ===================================================================

// check if token is verified or has bonus reward
app.get('/token/:tokenAddress/verfiedBonusReward', async (req, res) => {
  const tokenAddress = (`${req.params.tokenAddress}` || '').trim().toLowerCase();
  if (!tokenAddress) {
    utils.error('Empty token address');
    res.sendStatus(500);
    return;
  }
  try {
    const verified = await isTokenVerified(tokenAddress);
    const bonusReward = await hasBonusReward(tokenAddress);
    const resp = {
      verified,
      bonusReward
    };
    const respStr = utils.jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=3600',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    utils.error('Error in checking whether token: ' + tokenAddress + ' is verified or has bonus');
    utils.error(err);
    res.sendStatus(500);
  }
});

// fetch listings from opensea api
/**
 * supports queries
 * - query owner, tokenAddresses or tokenAddress, tokenIds,
 * - query tokenAddress, tokenIds
 * - query tokenAddresses, tokenIds
 * - query collection
 * - filters: offset, limit (max 50)
 * - sorting: orderBy: 'asc' | 'desc' orderDirection: 'sale_date' | 'sale_count' | 'sale_price'
 */
app.get('/opensea/listings', async (req, res) => {
  const { owner, tokenIds, tokenAddress, tokenAddresses, orderBy, orderDirection, offset, limit, collection } =
    req.query;

  const assetContractAddress = tokenAddress;
  const assetContractAddresses = tokenAddresses;
  const resp = await fetchAssetsFromOpensea(
    owner,
    tokenIds,
    assetContractAddress,
    assetContractAddresses,
    orderBy,
    orderDirection,
    offset,
    limit,
    collection
  );
  const stringifiedResp = utils.jsonString(resp);
  if (stringifiedResp) {
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(stringifiedResp, 'utf8')
    });
    res.send(stringifiedResp);
  } else {
    res.sendStatus(500);
  }
});

// fetch listings (for Explore page)
/*
- supports the following queries - from most to least restrictive
- supports tokenId and tokenAddress query
- supports collectionName, priceMin and priceMax query ordered by price
- supports all listings
- support title
*/
app.get('/listings', async (req, res) => {
  const { tokenId, listType, traitType, traitValue } = req.query;
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
  const { limit, startAfterPrice, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterPrice', 'startAfterMillis'],
    [`${DEFAULT_ITEMS_PER_PAGE}`, sortByPriceDirection === 'asc' ? '0' : `${DEFAULT_MAX_ETH}`, `${Date.now()}`]
  );
  if (error) {
    return;
  }

  if (
    listType &&
    listType !== types.ListType.FIXED_PRICE &&
    listType !== types.ListType.DUTCH_AUCTION &&
    listType !== types.ListType.ENGLISH_AUCTION
  ) {
    utils.error('Input error - invalid list type');
    res.sendStatus(500);
    return;
  }

  let resp;
  if (tokenAddress && tokenId) {
    resp = await getListingByTokenAddressAndId(tokenId, tokenAddress, limit);
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
  } else if (collectionName || priceMin || priceMax || listType) {
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
      traitValue
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

async function getListingByTokenAddressAndId(tokenId, tokenAddress, limit) {
  utils.log('Getting listings of token id and token address');
  try {
    let resp = '';
    const snapshot = await db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.asset.address', '==', tokenAddress)
      .limit(limit)
      .get();

    if (snapshot.docs.length === 0) {
      // get from db
      resp = await fetchAssetAsListingFromDb(tokenId, tokenAddress, limit);
    } else {
      resp = getOrdersResponse(snapshot);
    }
    return resp;
  } catch (err) {
    utils.error('Failed to get listing by tokend address and id', tokenAddress, tokenId);
    utils.error(err);
  }
}

async function fetchAssetAsListingFromDb(tokenId, tokenAddress, limit) {
  utils.log('Getting asset as listing from db');
  try {
    let resp = '';
    const snapshot = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.asset.address', '==', tokenAddress)
      .limit(limit)
      .get();

    if (snapshot.docs.length === 0) {
      // get from opensea
      resp = await fetchAssetFromOpensea(tokenId, tokenAddress);
    } else {
      resp = await getAssetsAsListings(snapshot);
    }
    return resp;
  } catch (err) {
    utils.error('Failed to get asset from db', tokenAddress, tokenId);
    utils.error(err);
  }
}

async function fetchAssetFromOpensea(tokenId, tokenAddress) {
  utils.log('Getting asset from Opensea');
  try {
    const url = constants.OPENSEA_API + 'asset/' + tokenAddress + '/' + tokenId;
    const authKey = process.env.openseaKey;
    const options = {
      headers: {
        'X-API-KEY': authKey
      }
    };
    const { data } = await axios.get(url, options);
    // store asset for future use
    return await saveRawOpenseaAssetInDatabase(data);
  } catch (err) {
    utils.error('Failed to get asset from opensea', tokenAddress, tokenId);
    utils.error(err);
  }
}

async function getAssetsAsListings(snapshot) {
  utils.log('Converting assets to listings');
  try {
    const listings = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const listing = data;
      listing.id = doc.id;
      listings.push(listing);
    }
    const resp = {
      count: listings.length,
      listings
    };
    return utils.jsonString(resp);
  } catch (err) {
    utils.error('Failed to convert assets to listings');
    utils.error(err);
  }
}

async function getAssetAsListing(docId, data) {
  utils.log('Converting asset to listing');
  try {
    const listings = [];
    const listing = data;
    listing.id = docId;
    listings.push(listing);
    const resp = {
      count: listings.length,
      listings
    };
    return utils.jsonString(resp);
  } catch (err) {
    utils.error('Failed to convert asset to listing');
    utils.error(err);
  }
}

async function assetDataToListing(data) {
  const assetContract = data.asset_contract;
  let tokenAddress = '';
  let schema = '';
  let description = data.description;
  let collectionName = '';
  if (assetContract) {
    tokenAddress = assetContract.address;
    schema = assetContract.schema_name;
    collectionName = assetContract.name;
    if (assetContract.description) {
      description = assetContract.description;
    }
  }
  const listing = {
    isListing: false,
    hasBlueCheck: await isTokenVerified(tokenAddress),
    schema,
    asset: {
      address: tokenAddress,
      id: data.token_id,
      collectionName,
      description,
      image: data.image_url,
      imagePreview: data.image_preview_url,
      searchCollectionName: getSearchFriendlyString(collectionName),
      searchTitle: getSearchFriendlyString(data.name),
      title: data.name
    }
  };
  return listing;
}

async function getListingsByCollection(startAfterBlueCheck, startAfterSearchCollectionName, limit) {
  try {
    let startAfterBlueCheckBool = true;
    if (startAfterBlueCheck !== undefined) {
      startAfterBlueCheckBool = startAfterBlueCheck === 'true';
    }

    const snapshot = await db
      .collectionGroup(fstrCnstnts.COLLECTION_LISTINGS_COLL)
      .orderBy('metadata.hasBlueCheck', 'desc')
      .orderBy('metadata.asset.searchCollectionName', 'asc')
      .startAfter(startAfterBlueCheckBool, startAfterSearchCollectionName)
      .limit(limit)
      .get();

    return getOrdersResponse(snapshot);
  } catch (err) {
    utils.error('Failed to get listings by collection from firestore');
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
  traitValue
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
        queryRef = queryRef.where('metadata.asset.searchCollectionName', '==', getSearchFriendlyString(collectionName));
      }

      if (traitType && traitValue) {
        queryRef = queryRef.where('metadata.asset.traits', 'array-contains', {
          traitType,
          traitValue
        });
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
    const startsWith = getSearchFriendlyString(text);
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

// eslint-disable-next-line no-unused-vars
async function getAllListings(sortByPriceDirection, startAfterPrice, startAfterMillis, startAfterBlueCheck, limit) {
  utils.log('Getting all listings');

  try {
    let query = db
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
    utils.error('Failed to get listings');
    utils.error(err);
  }
}

// fetch assets of user as public
app.get('/p/u/:user/assets', async (req, res) => {
  fetchAssetsOfUser(req, res);
});

// fetch assets of user
app.get('/u/:user/assets', async (req, res) => {
  fetchAssetsOfUser(req, res);
});

// get featured collections data. Data is imported from CSV file into DB using "firestore.js" script.
app.get('/featured-collections', async (req, res) => {
  utils.log('fetch list of Featured Collections');
  try {
    const result = await db.collection(fstrCnstnts.FEATURED_COLL).limit(constants.FEATURED_LIMIT).get();

    if (result.docs) {
      const { results: collections, count } = utils.docsToArray(result.docs);
      const respStr = utils.jsonString({ collections, count });
      res.set({
        'Cache-Control': 'must-revalidate, max-age=300',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(respStr);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    utils.error('Error fetching featured collections.');
    utils.error(err);
    res.sendStatus(500);
  }
});

// transaction events (for a collection or a token)
app.get('/events', async (req, res) => {
  const queryStr = decodeURIComponent(qs.stringify(req.query));
  const authKey = process.env.openseaKey;
  const url = constants.OPENSEA_API + `events?${queryStr}`;
  const options = {
    headers: {
      'X-API-KEY': authKey
    }
  };
  try {
    const { data } = await axios.get(url, options);
    const respStr = utils.jsonString(data);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    utils.error('Error occured while fetching events from opensea');
    utils.error(err);
    res.sendStatus(500);
  }
});

// fetch listings of user
app.get('/u/:user/listings', async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
    return;
  }
  if (!user) {
    utils.error('Empty user');
    res.sendStatus(500);
    return;
  }
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterMillis)
    .limit(limit)
    .get()
    .then((data) => {
      const resp = getOrdersResponse(data);
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get user listings for user ' + user);
      utils.error(err);
      res.sendStatus(500);
    });
});

// fetch offer made by user
app.get('/u/:user/offersmade', async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
    return;
  }
  if (!user) {
    utils.error('Empty user');
    res.sendStatus(500);
    return;
  }
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.OFFERS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterMillis)
    .limit(limit)
    .get()
    .then((data) => {
      const resp = getOrdersResponse(data);
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get offers made by user ' + user);
      utils.error(err);
      res.sendStatus(500);
    });
});

// fetch offer received by user
app.get('/u/:user/offersreceived', async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const sortByPrice = req.query.sortByPrice || 'desc'; // descending default
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
    return;
  }
  if (!user) {
    utils.error('Empty user');
    res.sendStatus(500);
    return;
  }
  db.collectionGroup(fstrCnstnts.OFFERS_COLL)
    .where('metadata.asset.owner', '==', user)
    // @ts-ignore
    .orderBy('metadata.basePriceInEth', sortByPrice)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterMillis)
    .limit(limit)
    .get()
    .then((data) => {
      const resp = getOrdersResponse(data);
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get offers received by user ' + user);
      utils.error(err);
      res.sendStatus(500);
    });
});

// fetch order to fulfill
app.get('/wyvern/v1/orders', async (req, res) => {
  const { maker, id, side, tokenAddress, tokenId } = req.query;
  let docId;

  if (req.query.id) {
    // @ts-ignore
    docId = req.query.id.trim(); // preserve case
  }

  if (docId && docId.length > 0) {
    return getOrdersWithDocId(res, { maker, id, side });
  }

  return getOrdersWithTokenId(res, { maker, tokenAddress, tokenId, side });
});

// TODO: refactor: don't pass the whole "req" or "res" => pass { vars... } instead.
const getOrdersWithDocId = async (res, { maker, id, side }) => {
  if (!maker || !id || !side || (side !== types.OrderSide.Buy.toString() && side !== types.OrderSide.Sell.toString())) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  const makerStr = maker.trim().toLowerCase();
  const docId = id.trim(); // preserve case
  const sideStr = side;
  let collection = fstrCnstnts.LISTINGS_COLL;
  try {
    if (sideStr === types.OrderSide.Buy.toString()) {
      collection = fstrCnstnts.OFFERS_COLL;
    }
    const doc = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(makerStr)
      .collection(collection)
      .doc(docId)
      .get();

    if (doc.exists) {
      const orders = [];
      const order = doc.data();
      order.id = doc.id;
      orders.push(order);
      const resp = {
        count: orders.length,
        orders: orders
      };
      res.send(resp);
    } else {
      res.sendStatus(404);
      return;
    }
  } catch (err) {
    utils.error('Error fetching order: ' + docId + ' for user ' + makerStr + ' from collection ' + collection);
    utils.error(err);
    res.sendStatus(500);
  }
};

const getOrdersWithTokenId = async (res, { maker, tokenAddress, tokenId, side }) => {
  if (
    !maker ||
    !tokenAddress ||
    !tokenId ||
    (side !== types.OrderSide.Buy.toString() && side !== types.OrderSide.Sell.toString())
  ) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  const makerStr = maker.trim().toLowerCase();
  const tokenAddressStr = tokenAddress.trim().toLowerCase();

  const docs = await getOrders(makerStr, tokenAddressStr, tokenId, +side);
  if (docs) {
    const orders = [];
    for (const doc of docs) {
      const order = doc.data();
      order.id = doc.id;
      orders.push(order);
    }
    const resp = {
      count: orders.length,
      orders: orders
    };
    res.send(resp);
  } else {
    res.sendStatus(404);
  }
};

async function getOrders(maker, tokenAddress, tokenId, side) {
  utils.log('Fetching order for', maker, tokenAddress, tokenId, side);

  let collection = fstrCnstnts.LISTINGS_COLL;
  if (side === 0) {
    collection = fstrCnstnts.OFFERS_COLL;
  }
  const results = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(collection)
    .where('metadata.asset.address', '==', tokenAddress)
    .where('metadata.asset.id', '==', tokenId)
    .where('side', '==', parseInt(side))
    .get();

  if (results.empty) {
    utils.log('No matching orders');
    return [];
  }
  return results.docs;
}

// fetch user reward
app.get('/u/:user/reward', utils.getUserRateLimit, async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  if (!user) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }
  try {
    const resp = await getReward(user);
    res.send(resp);
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// fetch rewards leaderboard
app.get('/rewards/leaderboard', async (req, res) => {
  try {
    const sales = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .orderBy('salesTotalNumeric', 'desc')
      .limit(10)
      .get();

    const saleLeaders = [];
    for (const doc of sales.docs) {
      const docData = doc.data();
      const result = {
        id: doc.id,
        total: docData.salesTotalNumeric
      };
      saleLeaders.push(result);
    }

    const buys = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .orderBy('purchasesTotalNumeric', 'desc')
      .limit(10)
      .get();

    const buyLeaders = [];
    for (const doc of buys.docs) {
      const docData = doc.data();
      const result = {
        id: doc.id,
        total: docData.purchasesTotalNumeric
      };
      buyLeaders.push(result);
    }

    const resp = {
      count: saleLeaders.length + buyLeaders.length,
      results: { saleLeaders, buyLeaders }
    };
    const respStr = utils.jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    utils.error('Failed to get leaderboard');
    utils.error(err);
    res.sendStatus(500);
  }
});

app.get('/titles', async (req, res) => {
  const startsWithOrig = req.query.startsWith;
  const startsWith = getSearchFriendlyString(startsWithOrig);
  if (startsWith && typeof startsWith === 'string') {
    const endCode = utils.getEndCode(startsWith);
    db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchTitle', '>=', startsWith)
      .where('metadata.asset.searchTitle', '<', endCode)
      .orderBy('metadata.asset.searchTitle')
      .select('metadata.asset.title', 'metadata.asset.address', 'metadata.asset.id')
      .limit(10)
      .get()
      .then((data) => {
        // to enable cdn cache
        const resp = data.docs.map((doc) => {
          return {
            title: doc.data().metadata.asset.title,
            id: doc.data().metadata.asset.id,
            address: doc.data().metadata.asset.address
          };
        });
        const respStr = utils.jsonString(resp);
        res.set({
          'Cache-Control': 'must-revalidate, max-age=60',
          'Content-Length': Buffer.byteLength(respStr, 'utf8')
        });

        res.send(respStr);
      })
      .catch((err) => {
        utils.error('Failed to get titles', err);
        res.sendStatus(500);
      });
  } else {
    res.send(utils.jsonString([]));
  }
});

app.get('/collections', async (req, res) => {
  const startsWithOrig = req.query.startsWith;
  const startsWith = getSearchFriendlyString(startsWithOrig);
  if (startsWith && typeof startsWith === 'string') {
    const endCode = utils.getEndCode(startsWith);
    db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchCollectionName', '>=', startsWith)
      .where('metadata.asset.searchCollectionName', '<', endCode)
      .orderBy('metadata.asset.searchCollectionName')
      .select('metadata.asset.address', 'metadata.asset.collectionName', 'metadata.hasBlueCheck')
      .limit(10)
      .get()
      .then((data) => {
        // to enable cdn cache
        let resp = data.docs.map((doc) => {
          const docData = doc.data();
          return {
            address: docData.metadata.asset.address,
            collectionName: docData.metadata.asset.collectionName,
            hasBlueCheck: docData.metadata.hasBlueCheck
          };
        });
        // remove duplicates and take only the first 10 results
        resp = utils.getUniqueItemsByProperties(resp, 'collectionName');
        const respStr = utils.jsonString(resp);
        res.set({
          'Cache-Control': 'must-revalidate, max-age=60',
          'Content-Length': Buffer.byteLength(respStr, 'utf8')
        });
        res.send(respStr);
      })
      .catch((err) => {
        utils.error('Failed to get collection names', err);
        res.sendStatus(500);
      });
  } else {
    res.send(utils.jsonString([]));
  }
});

// get traits & their values of a collection
app.get('/collections/:id/traits', async (req, res) => {
  utils.log('Fetching traits from NFT contract address.');
  const id = req.params.id.trim().toLowerCase();
  let resp = {};
  const traitMap = {}; // { name: { {info) }} }
  const authKey = process.env.openseaKey;
  const url = constants.OPENSEA_API + `assets/?asset_contract_address=${id}&limit=` + 50 + '&offset=' + 0;
  const options = {
    headers: {
      'X-API-KEY': authKey
    }
  };
  try {
    const { data } = await axios.get(url, options);
    // console.log('data', data);
    const traits = [];
    if (data && data.assets) {
      data.assets.forEach((item) => {
        item.traits.forEach((trait) => {
          traitMap[trait.trait_type] = traitMap[trait.trait_type] || trait;
          traitMap[trait.trait_type].values = traitMap[trait.trait_type].values || [];
          if (traitMap[trait.trait_type].values.indexOf(trait.value) < 0) {
            traitMap[trait.trait_type].values.push(trait.value);
          }
        });
      });
      Object.keys(traitMap).forEach((traitName) => {
        traits.push(traitMap[traitName]);
      });
    }

    resp = {
      traits
    };
    // store in firestore for future use
    db.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(id).set(resp, { merge: true });

    // return response
    const respStr = utils.jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=300',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    utils.error('Error occured while fetching assets from opensea');
    utils.error(err);
    res.sendStatus(500);
  }
});

app.get('/u/:user/wyvern/v1/txns', async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
    return;
  }
  if (!user) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }
  try {
    const snapshot = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.TXNS_COLL)
      .orderBy('createdAt', 'desc')
      .startAfter(startAfterMillis)
      .limit(limit)
      .get();

    const missedTxnSnapshot = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.MISSED_TXNS_COLL)
      .orderBy('createdAt', 'desc')
      .startAfter(startAfterMillis)
      .limit(limit)
      .get();

    const txns = [];
    for (const doc of snapshot.docs) {
      const txn = doc.data();
      txn.id = doc.id;
      txns.push(txn);
      // check status
      if (txn.status === 'pending') {
        waitForTxn(user, txn);
      }
    }

    for (const doc of missedTxnSnapshot.docs) {
      const txn = doc.data();
      txn.id = doc.id;
      txns.push(txn);
      // check status
      if (txn.status === 'pending') {
        waitForMissedTxn(user, txn);
      }
    }

    const resp = {
      count: txns.length,
      listings: txns
    };
    const respStr = utils.jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    utils.error('Failed to get pending txns of user ' + user);
    utils.error(err);
    res.sendStatus(500);
  }
});

// =============================================== POSTS =====================================================================

app.get('/verifiedCollections', async (req, res) => {
  const startAfterName = req.query.startAfterName || '';
  const limit = +(req.query.limit || 50);

  try {
    let query = db
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .where('hasBlueCheck', '==', true)
      .orderBy('name', 'asc');

    if (startAfterName) {
      query = query.startAfter(startAfterName);
    }

    const data = await query.limit(limit).get();

    const collections = [];
    for (const doc of data.docs) {
      const data = doc.data();

      data.id = doc.id;
      collections.push(data);
    }

    const dataObj = {
      count: collections.length,
      collections
    };

    const resp = utils.jsonString(dataObj);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=600',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
    });
    res.send(resp);
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// post a listing or make offer
app.post('/u/:user/wyvern/v1/orders', utils.postUserRateLimit, async (req, res) => {
  const payload = req.body;

  if (Object.keys(payload).length === 0) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  if (
    !payload ||
    !payload.hash ||
    !payload.metadata ||
    !payload.metadata.asset ||
    !payload.metadata.asset.address ||
    !payload.metadata.asset.collectionName ||
    !payload.metadata.asset.searchCollectionName ||
    !payload.metadata.basePriceInEth
  ) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  if (
    !payload.englishAuctionReservePrice &&
    (!payload.feeRecipient || payload.feeRecipient.trim().toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase())
  ) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  if (payload.metadata.asset.id === undefined || payload.metadata.asset.id === null) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();

  const maker = (`${req.params.user}` || '').trim().toLowerCase();
  if (!maker) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }
  // default one order per post call
  const numOrders = 1;
  const batch = db.batch();
  utils.log('Making an order for user: ' + maker);
  try {
    // check if token has bonus if payload instructs so
    let hasBonus = payload.metadata.hasBonusReward;
    if (payload.metadata.checkBonusReward) {
      hasBonus = await hasBonusReward(tokenAddress);
    }
    payload.metadata.hasBonusReward = hasBonus;

    if (payload.side === 1) {
      // listing
      await postListing(maker, payload, batch, numOrders, hasBonus);
    } else if (payload.side === 0) {
      // offer
      await postOffer(maker, payload, batch, numOrders, hasBonus);
    } else {
      utils.error('Unknown order type');
      res.sendStatus(500);
      return;
    }

    // commit batch
    utils.log('Committing post order batch to firestore');
    batch
      .commit()
      .then((resp) => {
        res.send(payload);
      })
      .catch((err) => {
        utils.error('Failed to post order');
        utils.error(err);
        res.sendStatus(500);
      });
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// save txn
// called on buy now, accept offer, cancel offer, cancel listing
app.post('/u/:user/wyvern/v1/txns', utils.postUserRateLimit, async (req, res) => {
  try {
    const payload = req.body;

    if (Object.keys(payload).length === 0) {
      utils.error('Invalid input');
      res.sendStatus(500);
      return;
    }

    const user = (`${req.params.user}` || '').trim().toLowerCase();
    if (!user) {
      utils.error('Invalid input');
      res.sendStatus(500);
      return;
    }

    if (!payload.actionType || !payload.txnHash || !payload.orderId || !payload.maker) {
      utils.error('Invalid input');
      res.sendStatus(500);
      return;
    }

    // input checking
    let inputError = '';
    const actionType = payload.actionType.trim().toLowerCase(); // either fulfill or cancel
    if (actionType !== 'fulfill' && actionType !== 'cancel') {
      inputError += 'Invalid actionType: ' + actionType + ' ';
    }

    const txnHash = payload.txnHash.trim(); // preserve case
    if (!txnHash) {
      inputError += 'Payload does not have txnHash ';
    }

    const side = +payload.side;
    if (side !== 0 && side !== 1) {
      inputError += 'Unknown order side: ' + side + ' ';
    }

    const orderId = payload.orderId.trim(); // preserve case
    if (!orderId) {
      inputError += 'Payload does not have orderId ';
    }

    // input checking for fulfill action
    if (actionType === 'fulfill') {
      const salePriceInEth = +payload.salePriceInEth;
      if (isNaN(salePriceInEth)) {
        inputError += 'Invalid salePriceInEth: ' + salePriceInEth + ' ';
      }

      const feesInEth = +payload.feesInEth;
      if (isNaN(feesInEth)) {
        inputError += 'Invalid feesInEth: ' + feesInEth + ' ';
      }

      const maker = payload.maker.trim().toLowerCase();
      if (!maker) {
        inputError += 'Payload does not have maker ';
      }
    }

    if (inputError) {
      utils.error('Invalid input');
      res.sendStatus(500);
      return;
    }

    // check if already exists
    const docRef = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.TXNS_COLL)
      .doc(txnHash);

    const doc = await docRef.get();
    if (doc.exists) {
      utils.error('Txn already exists in firestore', txnHash);
      res.status(500).send('Txn already exists: ' + txnHash);
      return;
    }

    // save to firestore
    payload.status = 'pending';
    payload.txnType = 'original'; // possible values are original, cancellation and replacement
    payload.createdAt = Date.now();
    utils.log('Writing txn', txnHash, 'in pending state to firestore for user', user);
    docRef
      .set(payload)
      .then(() => {
        // listen for txn mined or not mined
        waitForTxn(user, payload);
        res.sendStatus(200);
      })
      .catch((err) => {
        utils.error('Error saving pending txn');
        utils.error(err);
        res.sendStatus(500);
      });
  } catch (err) {
    utils.error('Error saving pending txn');
    utils.error(err);
    res.sendStatus(500);
  }
});

// check txn
app.post('/u/:user/wyvern/v1/txns/check', utils.postUserRateLimit, async (req, res) => {
  try {
    const payload = req.body;

    if (Object.keys(payload).length === 0) {
      utils.error('Invalid input - payload empty');
      res.sendStatus(500);
      return;
    }

    const user = (`${req.params.user}` || '').trim().toLowerCase();
    if (!user) {
      utils.error('Invalid input - no user');
      res.sendStatus(500);
      return;
    }

    if (!payload.txnHash || !payload.txnHash.trim()) {
      utils.error('Invalid input - no txn hash');
      res.sendStatus(500);
      return;
    }

    if (!payload.actionType) {
      utils.error('Invalid input - no action type');
      res.sendStatus(500);
      return;
    }

    const actionType = payload.actionType.trim().toLowerCase(); // either fulfill or cancel
    if (actionType !== 'fulfill' && actionType !== 'cancel') {
      utils.error('Invalid action type', actionType);
      res.sendStatus(500);
      return;
    }

    const txnHash = payload.txnHash.trim(); // preserve case

    // check if valid nftc txn
    const { isValid, from, buyer, seller, value } = await getTxnData(txnHash, actionType);
    if (!isValid) {
      utils.error('Invalid NFTC txn', txnHash);
      res.sendStatus(500);
      return;
    } else {
      // check if doc exists
      const docRef = db
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(from)
        .collection(fstrCnstnts.TXNS_COLL)
        .doc(txnHash);

      const doc = await docRef.get();
      if (doc.exists) {
        // listen for txn mined or not mined
        waitForTxn(from, doc.data());
        res.sendStatus(200);
        return;
      } else {
        // txn is valid but it doesn't exist in firestore
        // we write to firestore
        utils.log('Txn', txnHash, 'is valid but it doesnt exist in firestore');
        const batch = db.batch();
        const valueInEth = +ethers.utils.formatEther('' + value);

        const txnPayload = {
          txnHash,
          status: 'pending',
          salePriceInEth: valueInEth,
          actionType,
          createdAt: Date.now(),
          buyer,
          seller
        };

        // if cancel order
        if (actionType === 'cancel') {
          const cancelTxnRef = db
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(from)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          batch.set(cancelTxnRef, txnPayload, { merge: true });
        } else if (actionType === 'fulfill') {
          const buyerTxnRef = db
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(buyer)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          batch.set(buyerTxnRef, txnPayload, { merge: true });

          const sellerTxnRef = db
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(seller)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          batch.set(sellerTxnRef, txnPayload, { merge: true });
        }

        // commit batch
        utils.log('Committing the non-existent valid txn', txnHash, ' batch to firestore');
        batch
          .commit()
          .then((resp) => {
            // no op
          })
          .catch((err) => {
            utils.error('Failed to commit non-existent valid txn', txnHash, ' batch');
            utils.error(err);
            res.sendStatus(500);
          });
      }
    }
    res.sendStatus(200);
  } catch (err) {
    utils.error('Error saving pending txn');
    utils.error(err);
    res.sendStatus(500);
  }
});

// ====================================================== Write helpers ==========================================================

const openseaAbi = require('./abi/openseaExchangeContract.json');

async function getTxnData(txnHash, actionType) {
  let isValid = true;
  let from = '';
  let buyer = '';
  let seller = '';
  let value = bn(0);
  const txn = await ethersProvider.getTransaction(txnHash);
  if (txn) {
    from = txn.from ? txn.from.trim().toLowerCase() : '';
    const to = txn.to;
    const chainId = txn.chainId;
    const data = txn.data;
    value = txn.value;
    const openseaIface = new ethers.utils.Interface(openseaAbi);
    const decodedData = openseaIface.parseTransaction({ data, value });
    const functionName = decodedData.name;
    const args = decodedData.args;

    // checks
    if (to.toLowerCase() !== constants.WYVERN_EXCHANGE_ADDRESS.toLowerCase()) {
      isValid = false;
    }
    // polymain
    if (chainId !== constants.ETH_CHAIN_ID) {
      isValid = false;
    }
    if (actionType === 'fulfill' && functionName !== constants.WYVERN_ATOMIC_MATCH_FUNCTION) {
      isValid = false;
    }
    if (actionType === 'cancel' && functionName !== constants.WYVERN_CANCEL_ORDER_FUNCTION) {
      isValid = false;
    }

    if (args && args.length > 0) {
      const addresses = args[0];
      if (addresses && actionType === 'fulfill' && addresses.length === 14) {
        buyer = addresses[1] ? addresses[1].trim().toLowerCase() : '';
        seller = addresses[8] ? addresses[8].trim().toLowerCase() : '';
        const buyFeeRecipient = addresses[3];
        const sellFeeRecipient = addresses[10];
        if (
          buyFeeRecipient.toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase() &&
          sellFeeRecipient.toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase()
        ) {
          isValid = false;
        }
      } else if (addresses && actionType === 'cancel' && addresses.length === 7) {
        const feeRecipient = addresses[3];
        if (feeRecipient.toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase()) {
          isValid = false;
        }
      } else {
        isValid = false;
      }
    } else {
      isValid = false;
    }
  } else {
    isValid = false;
  }
  return { isValid, from, buyer, seller, value };
}

async function isValidNftcTxn(txnHash, actionType) {
  let isValid = true;
  const txn = await ethersProvider.getTransaction(txnHash);
  if (txn) {
    const to = txn.to;
    const chainId = txn.chainId;
    const data = txn.data;
    const value = txn.value;
    const openseaIface = new ethers.utils.Interface(openseaAbi);
    const decodedData = openseaIface.parseTransaction({ data, value });
    const functionName = decodedData.name;
    const args = decodedData.args;

    // checks
    if (to.toLowerCase() !== constants.WYVERN_EXCHANGE_ADDRESS.toLowerCase()) {
      isValid = false;
    }
    // polymain
    if (chainId !== constants.ETH_CHAIN_ID) {
      isValid = false;
    }
    if (actionType === 'fulfill' && functionName !== constants.WYVERN_ATOMIC_MATCH_FUNCTION) {
      isValid = false;
    }
    if (actionType === 'cancel' && functionName !== constants.WYVERN_CANCEL_ORDER_FUNCTION) {
      isValid = false;
    }

    if (args && args.length > 0) {
      const addresses = args[0];
      if (addresses && actionType === 'fulfill' && addresses.length === 14) {
        const buyFeeRecipient = args[0][3];
        const sellFeeRecipient = args[0][10];
        if (
          buyFeeRecipient.toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase() &&
          sellFeeRecipient.toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase()
        ) {
          isValid = false;
        }
      } else if (addresses && actionType === 'cancel' && addresses.length === 7) {
        const feeRecipient = args[0][3];
        if (feeRecipient.toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase()) {
          isValid = false;
        }
      } else {
        isValid = false;
      }
    } else {
      isValid = false;
    }
  } else {
    isValid = false;
  }
  return isValid;
}

async function waitForTxn(user, payload) {
  user = user.trim().toLowerCase();
  const actionType = payload.actionType.trim().toLowerCase();
  const origTxnHash = payload.txnHash.trim();

  utils.log('Waiting for txn', origTxnHash);
  const batch = db.batch();
  const userTxnCollRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.TXNS_COLL);

  const origTxnDocRef = userTxnCollRef.doc(origTxnHash);
  const confirms = 1;

  try {
    // check if valid nftc txn
    const isValid = await isValidNftcTxn(origTxnHash, actionType);
    if (!isValid) {
      utils.error('Invalid NFTC txn', origTxnHash);
      return;
    }

    const receipt = await ethersProvider.waitForTransaction(origTxnHash, confirms);

    // check if txn status is not already updated in firestore by another call - (from the get txns method for instance)
    try {
      const isUpdated = await db.runTransaction(async (txn) => {
        const txnDoc = await txn.get(origTxnDocRef);
        const status = txnDoc.get('status');
        if (status === 'pending') {
          // orig txn confirmed
          utils.log('Txn: ' + origTxnHash + ' confirmed after ' + receipt.confirmations + ' block(s)');
          const txnData = JSON.parse(utils.jsonString(receipt));
          const txnSuceeded = txnData.status === 1;
          const updatedStatus = txnSuceeded ? 'confirmed' : 'failed';
          await txn.update(origTxnDocRef, { status: updatedStatus, txnData });
          return txnSuceeded;
        } else {
          return false;
        }
      });

      if (isUpdated) {
        if (actionType === 'fulfill') {
          await fulfillOrder(user, batch, payload);
        } else if (actionType === 'cancel') {
          const docId = payload.orderId.trim(); // preserve case
          const side = +payload.side;
          if (side === 0) {
            await cancelOffer(user, batch, docId);
          } else if (side === 1) {
            await cancelListing(user, batch, docId);
          }
        }
      }
    } catch (err) {
      utils.error('Error updating txn status in firestore');
      utils.error(err);
    }
  } catch (err) {
    utils.error('Txn: ' + origTxnHash + ' was rejected');
    // if the txn failed, err.receipt.status = 0
    if (err.receipt && err.receipt.status === 0) {
      utils.error('Txn with hash: ' + origTxnHash + ' rejected');
      utils.error(err);

      const txnData = JSON.parse(utils.jsonString(err.receipt));
      batch.set(origTxnDocRef, { status: 'rejected', txnData }, { merge: true });
    }
    // if the txn failed due to replacement or cancellation or repricing
    if (err && err.reason && err.replacement) {
      utils.error('Txn with hash: ' + origTxnHash + ' rejected with reason ' + err.reason);
      utils.error(err);

      const replacementTxnHash = err.replacement.hash;
      if (err.reason === 'cancelled') {
        payload.txnType = 'cancellation';
        batch.set(origTxnDocRef, { status: 'cancelled', cancelTxnHash: replacementTxnHash }, { merge: true });
      } else {
        payload.txnType = 'replacement';
        batch.set(origTxnDocRef, { status: 'replaced', replaceTxnHash: replacementTxnHash }, { merge: true });
      }
      // write a new pending txn in firestore
      utils.log('Writing replacement txn: ' + replacementTxnHash + ' to firestore');
      const newTxnDocRef = userTxnCollRef.doc(replacementTxnHash);
      payload.createdAt = Date.now();
      const newPayload = {
        origTxnHash,
        ...payload
      };
      batch.set(newTxnDocRef, newPayload);
    }
  }

  // commit batch
  utils.log('Committing the big `wait for txn`', origTxnHash, 'batch to firestore');
  batch
    .commit()
    .then((resp) => {
      // no op
    })
    .catch((err) => {
      utils.error('Failed to commit pending txn batch');
      utils.error(err);
    });
}

async function waitForMissedTxn(user, payload) {
  user = user.trim().toLowerCase();
  const actionType = payload.actionType.trim().toLowerCase();
  const txnHash = payload.txnHash.trim();

  utils.log('Waiting for missed txn', txnHash);
  const batch = db.batch();
  const userTxnCollRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.MISSED_TXNS_COLL);

  const txnDocRef = userTxnCollRef.doc(txnHash);
  const confirms = 1;

  try {
    // check if valid nftc txn
    const isValid = await isValidNftcTxn(txnHash, actionType);
    if (!isValid) {
      utils.error('Invalid NFTC txn', txnHash);
      return;
    }

    const receipt = await ethersProvider.waitForTransaction(txnHash, confirms);

    // check if txn status is not already updated in firestore by another call
    try {
      const isUpdated = await db.runTransaction(async (txn) => {
        const txnDoc = await txn.get(txnDocRef);
        if (actionType === 'fulfill') {
          const buyer = txnDoc.get('buyer');
          const seller = txnDoc.get('seller');

          const buyerTxnRef = db
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(buyer)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          const sellerTxnRef = db
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(seller)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          const buyerTxnDoc = await txn.get(buyerTxnRef);
          const sellerTxnDoc = await txn.get(sellerTxnRef);

          const buyerStatus = buyerTxnDoc.get('status');
          const sellerStatus = sellerTxnDoc.get('status');
          if (buyerStatus === 'pending' && sellerStatus === 'pending') {
            // orig txn confirmed
            utils.log('Missed fulfill txn: ' + txnHash + ' confirmed after ' + receipt.confirmations + ' block(s)');
            const txnData = JSON.parse(utils.jsonString(receipt));
            const txnSuceeded = txnData.status === 1;
            const updatedStatus = txnSuceeded ? 'confirmed' : 'failed';
            await txn.update(buyerTxnRef, { status: updatedStatus, txnData });
            await txn.update(sellerTxnRef, { status: updatedStatus, txnData });
            return txnSuceeded;
          } else {
            return false;
          }
        } else if (actionType === 'cancel') {
          const docRef = db
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(user)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          const doc = await txn.get(docRef);
          const status = doc.get('status');
          if (status === 'pending') {
            // orig txn confirmed
            utils.log('Missed cancel txn: ' + txnHash + ' confirmed after ' + receipt.confirmations + ' block(s)');
            const txnData = JSON.parse(utils.jsonString(receipt));
            const txnSuceeded = txnData.status === 1;
            const updatedStatus = txnSuceeded ? 'confirmed' : 'failed';
            await txn.update(docRef, { status: updatedStatus, txnData });
            return txnSuceeded;
          } else {
            return false;
          }
        }
        return false;
      });

      if (isUpdated) {
        if (actionType === 'fulfill') {
          const numOrders = 1;
          const buyer = payload.buyer.trim().toLowerCase();
          const seller = payload.seller.trim().toLowerCase();
          const valueInEth = payload.salePriceInEth;

          const buyerRef = db
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(buyer);

          const sellerRef = db
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(seller);

          const buyerInfoRef = await buyerRef.get();
          let buyerInfo = getEmptyUserInfo();
          if (buyerInfoRef.exists) {
            buyerInfo = { ...buyerInfo, ...buyerInfoRef.data() };
          }

          const sellerInfoRef = await sellerRef.get();
          let sellerInfo = getEmptyUserInfo();
          if (sellerInfoRef.exists) {
            sellerInfo = { ...sellerInfo, ...sellerInfoRef.data() };
          }

          // update user txn stats
          // @ts-ignore
          const purchasesTotal = bn(buyerInfo.purchasesTotal).plus(valueInEth).toString();
          // @ts-ignore
          const purchasesTotalNumeric = toFixed5(purchasesTotal);

          // update user txn stats
          // @ts-ignore
          const salesTotal = bn(sellerInfo.salesTotal).plus(valueInEth).toString();
          // @ts-ignore
          const salesTotalNumeric = toFixed5(salesTotal);

          utils.trace(
            'Buyer',
            buyer,
            'Seller',
            seller,
            'purchases total',
            purchasesTotal,
            'purchases total numeric',
            purchasesTotalNumeric,
            'sales total',
            salesTotal,
            'sales total numeric',
            salesTotalNumeric
          );

          batch.set(
            buyerRef,
            {
              numPurchases: firebaseAdmin.firestore.FieldValue.increment(numOrders),
              purchasesTotal,
              purchasesTotalNumeric
            },
            { merge: true }
          );

          batch.set(
            sellerRef,
            {
              numSales: firebaseAdmin.firestore.FieldValue.increment(numOrders),
              salesTotal,
              salesTotalNumeric
            },
            { merge: true }
          );

          // commit batch
          utils.log('Updating purchase and sale data for missed txn', txnHash, 'in firestore');
          batch
            .commit()
            .then((resp) => {
              // no op
            })
            .catch((err) => {
              utils.error('Failed updating purchase and sale data for missed txn', txnHash);
              utils.error(err);
            });
        }
      }
    } catch (err) {
      utils.error('Error updating missed txn status in firestore');
      utils.error(err);
    }
  } catch (err) {
    utils.error('Error waiting for missed txn');
    utils.error(err);
  }
}

// order fulfill
async function fulfillOrder(user, batch, payload) {
  // user is the taker of the order - either bought now or accepted offer
  // write to bought and sold and delete from listing, offer made, offer recvd
  /* cases in which order is fulfilled:
    1) listed an item and a buy now is made on it; order is the listing
    2) listed an item, offer received on it, offer is accepted; order is the offerReceived
    3) no listing made, but offer is received on it, offer is accepted; order is the offerReceived
  */
  try {
    const taker = user.trim().toLowerCase();
    const salePriceInEth = +payload.salePriceInEth;
    const side = +payload.side;
    const docId = payload.orderId.trim(); // preserve case
    const feesInEth = +payload.feesInEth;
    const txnHash = payload.txnHash;
    const maker = payload.maker.trim().toLowerCase();
    utils.log(
      'Fulfilling order for taker',
      taker,
      'maker',
      maker,
      'sale price ETH',
      salePriceInEth,
      'fees in Eth',
      feesInEth,
      'and txn hash',
      txnHash
    );

    const numOrders = 1;

    if (side !== 0 && side !== 1) {
      utils.error('Unknown order side ' + side + ' , not fulfilling it');
      return;
    }

    // record txn for maker
    const txnPayload = {
      txnHash,
      status: 'confirmed',
      salePriceInEth,
      actionType: payload.actionType.trim().toLowerCase(),
      createdAt: Date.now()
    };

    const makerTxnRef = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(maker)
      .collection(fstrCnstnts.TXNS_COLL)
      .doc(txnHash);

    batch.set(makerTxnRef, txnPayload, { merge: true });

    if (side === 0) {
      // taker accepted offerReceived, maker is the buyer

      // check if order exists
      const docSnap = await db
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(maker)
        .collection(fstrCnstnts.OFFERS_COLL)
        .doc(docId)
        .get();
      if (!docSnap.exists) {
        utils.log('No offer ' + docId + ' to fulfill');
        return;
      }

      const doc = docSnap.data();
      doc.taker = taker;
      doc.metadata.salePriceInEth = salePriceInEth;
      doc.metadata.feesInEth = feesInEth;
      doc.metadata.txnHash = txnHash;

      utils.log('Item bought by ' + maker + ' sold by ' + taker);

      // write to bought by maker; multiple items possible
      await saveBoughtOrder(maker, doc, batch, numOrders);

      // write to sold by taker; multiple items possible
      await saveSoldOrder(taker, doc, batch, numOrders);

      // delete offerMade by maker
      await deleteOfferMadeWithId(docId, maker, batch);

      // delete listing by taker if it exists
      await deleteListingWithId(docId, taker, batch);

      // send email to maker that the offer is accepted
      prepareEmail(maker, doc, 'offerAccepted');
    } else if (side === 1) {
      // taker bought a listing, maker is the seller

      // check if order exists
      const docSnap = await db
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(maker)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .doc(docId)
        .get();
      if (!docSnap.exists) {
        utils.log('No listing ' + docId + ' to fulfill');
        return;
      }

      const doc = docSnap.data();
      doc.taker = taker;
      doc.metadata.salePriceInEth = salePriceInEth;
      doc.metadata.feesInEth = feesInEth;
      doc.metadata.txnHash = txnHash;

      utils.log('Item bought by ' + taker + ' sold by ' + maker);

      // write to bought by taker; multiple items possible
      await saveBoughtOrder(taker, doc, batch, numOrders);

      // write to sold by maker; multiple items possible
      await saveSoldOrder(maker, doc, batch, numOrders);

      // delete listing from maker
      await deleteListingWithId(docId, maker, batch);

      // send email to maker that the item is purchased
      prepareEmail(maker, doc, 'itemPurchased');
    }
  } catch (err) {
    utils.error('Error in fufilling order');
    utils.error(err);
  }
}

async function saveBoughtOrder(user, order, batch, numOrders) {
  utils.log('Writing purchase to firestore for user', user);
  order.metadata.createdAt = Date.now();
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.PURCHASES_COLL)
    .doc();
  batch.set(ref, order, { merge: true });

  const fees = bn(order.metadata.feesInEth);
  const purchaseFees = fees.div(constants.SALE_FEES_TO_PURCHASE_FEES_RATIO);
  const salePriceInEth = bn(order.metadata.salePriceInEth);

  const userInfoRef = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  const userInfo = { ...getEmptyUserInfo(), ...userInfoRef.data() };

  // update user txn stats
  // @ts-ignore
  const purchasesTotal = bn(userInfo.purchasesTotal).plus(salePriceInEth).toString();
  // @ts-ignore
  const purchasesFeesTotal = bn(userInfo.purchasesFeesTotal).plus(purchaseFees).toString();
  const purchasesTotalNumeric = toFixed5(purchasesTotal);
  const purchasesFeesTotalNumeric = toFixed5(purchasesFeesTotal);
  const salesAndPurchasesTotalNumeric = userInfo.salesAndPurchasesTotalNumeric + purchasesTotalNumeric;

  utils.trace(
    'User',
    user,
    'User purchases total',
    purchasesTotal,
    'purchases fees total',
    purchasesFeesTotal,
    'purchases total numeric',
    purchasesTotalNumeric,
    'purchases fees total numeric',
    purchasesFeesTotalNumeric,
    'salesAndPurchasesTotalNumeric',
    salesAndPurchasesTotalNumeric
  );

  const userDocRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);

  batch.set(
    userDocRef,
    {
      numPurchases: firebaseAdmin.firestore.FieldValue.increment(numOrders),
      purchasesTotal,
      purchasesFeesTotal,
      purchasesTotalNumeric,
      purchasesFeesTotalNumeric,
      salesAndPurchasesTotalNumeric
    },
    { merge: true }
  );
}

async function saveSoldOrder(user, order, batch, numOrders) {
  utils.log('Writing sale to firestore for user', user);
  order.metadata.createdAt = Date.now();
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.SALES_COLL)
    .doc();
  batch.set(ref, order, { merge: true });

  const feesInEth = bn(order.metadata.feesInEth);
  const salePriceInEth = bn(order.metadata.salePriceInEth);

  const userInfoRef = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  const userInfo = { ...getEmptyUserInfo(), ...userInfoRef.data() };

  // update user txn stats
  // @ts-ignore
  const salesTotal = bn(userInfo.salesTotal).plus(salePriceInEth).toString();
  // @ts-ignore
  const salesFeesTotal = bn(userInfo.salesFeesTotal).plus(feesInEth).toString();
  const salesTotalNumeric = toFixed5(salesTotal);
  const salesFeesTotalNumeric = toFixed5(salesFeesTotal);
  const salesAndPurchasesTotalNumeric = userInfo.salesAndPurchasesTotalNumeric + salesTotalNumeric;

  utils.trace(
    'User',
    user,
    'User sales total',
    salesTotal,
    'sales fees total',
    salesFeesTotal,
    'sales total numeric',
    salesTotalNumeric,
    'sales fees total numeric',
    salesFeesTotalNumeric,
    'salesAndPurchasesTotalNumeric',
    salesAndPurchasesTotalNumeric
  );

  const userDocRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);

  batch.set(
    userDocRef,
    {
      numSales: firebaseAdmin.firestore.FieldValue.increment(numOrders),
      salesTotal,
      salesFeesTotal,
      salesTotalNumeric,
      salesFeesTotalNumeric,
      salesAndPurchasesTotalNumeric
    },
    { merge: true }
  );
}

async function postListing(maker, payload, batch, numOrders, hasBonus) {
  utils.log('Writing listing to firestore for user + ' + maker);
  const { basePrice } = payload;
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  const tokenId = payload.metadata.asset.id.trim();

  // check if token is verified if payload instructs so
  let blueCheck = payload.metadata.hasBlueCheck;
  if (payload.metadata.checkBlueCheck) {
    blueCheck = await isTokenVerified(tokenAddress);
  }
  payload.metadata.hasBlueCheck = blueCheck;
  payload.metadata.createdAt = Date.now();

  // write listing
  const listingRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc(getDocId({ tokenAddress, tokenId, basePrice }));

  batch.set(listingRef, payload, { merge: true });

  // store as asset for future use
  const listingAsAssetRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.ASSETS_COLL)
    .doc(getDocId({ tokenAddress, tokenId, basePrice: '' }));

  batch.set(listingAsAssetRef, payload, { merge: true });

  // update collection listings
  try {
    db.collection(fstrCnstnts.COLLECTION_LISTINGS_COLL)
      .doc(tokenAddress)
      .set(
        {
          numListings: firebaseAdmin.firestore.FieldValue.increment(numOrders),
          metadata: {
            hasBlueCheck: payload.metadata.hasBlueCheck,
            schema: payload.metadata.schema,
            asset: {
              address: tokenAddress,
              collectionName: payload.metadata.asset.collectionName,
              searchCollectionName: payload.metadata.asset.searchCollectionName,
              description: payload.metadata.asset.description,
              image: payload.metadata.asset.image,
              imagePreview: payload.metadata.asset.imagePreview
            }
          }
        },
        { merge: true }
      );
  } catch (err) {
    utils.error('Error updating root collection data on post listing');
    utils.error(err);
  }

  // update num user listings
  updateNumOrders(batch, maker, numOrders, hasBonus, 1);
}

async function postOffer(maker, payload, batch, numOrders, hasBonus) {
  utils.log('Writing offer to firestore for user', maker);
  const taker = payload.metadata.asset.owner.trim().toLowerCase();
  const { basePrice } = payload;
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  const tokenId = payload.metadata.asset.id.trim();
  payload.metadata.createdAt = Date.now();

  // store data in offers of maker
  const offerRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.OFFERS_COLL)
    .doc(getDocId({ tokenAddress, tokenId, basePrice }));
  batch.set(offerRef, payload, { merge: true });

  utils.log('updating num offers since offer does not exist');
  // update num user offers made
  updateNumOrders(batch, maker, numOrders, hasBonus, 0);

  // send email to taker that an offer is made
  prepareEmail(taker, payload, 'offerMade');
}

function updateNumOrders(batch, user, num, hasBonus, side) {
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

// ================================================= Read helpers =================================================

function getOrdersResponse(data) {
  return getOrdersResponseFromArray(data.docs);
}

function getOrdersResponseFromArray(docs) {
  const listings = [];
  for (const doc of docs) {
    const listing = doc.data();
    const isExpired = isOrderExpired(doc);
    try {
      checkOwnershipChange(doc);
    } catch (err) {
      utils.error('Error checking ownership change info', err);
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
  return utils.jsonString(resp);
}

async function fetchAssetsOfUser(req, res) {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { source } = req.query;
  const { limit, offset, error } = utils.parseQueryFields(res, req, ['limit', 'offset'], ['50', `0`]);
  if (error) {
    return;
  }
  if (!user) {
    utils.error('Empty user');
    res.sendStatus(500);
    return;
  }
  const sourceName = nftDataSources[source];
  if (!sourceName) {
    utils.error('Empty sourceName');
    res.sendStatus(500);
    return;
  }
  try {
    let resp = await getAssets(user, limit, offset, sourceName);
    resp = utils.jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
    });
    res.send(resp);
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
}

async function getAssets(address, limit, offset, sourceName) {
  utils.log('Fetching assets for', address);
  const results = await getAssetsFromChain(address, limit, offset, sourceName);
  return results;
}

async function getAssetsFromChain(address, limit, offset, sourceName) {
  let data;
  switch (sourceName) {
    case 'nftc':
      data = await getAssetsFromNftc(address, limit, offset);
      break;
    case 'alchemy':
      data = await getAssetsFromAlchemy(address, limit, offset);
      break;
    case 'unmarshal':
      data = await getAssetsFromUnmarshal(address, limit, offset);
      break;
    case 'opensea':
      data = await getAssetsFromOpenseaByOwner(address, limit, offset);
      break;
    case 'covalent':
      data = await getAssetsFromCovalent(address, limit, offset);
      break;
    default:
      utils.log('Invalid data source for fetching nft data of wallet');
  }
  return data;
}

async function getAssetsFromNftc(address, limit, offset) {
  utils.log('Fetching assets from nftc');
}

async function getAssetsFromAlchemy(address, limit, offset) {
  utils.log('Fetching assets from alchemy');
}

async function getAssetsFromCovalent(address, limit, offset) {
  utils.log('Fetching assets from covalent');
  const apiBase = 'https://api.covalenthq.com/v1/';
  const chain = '137';
  const authKey = process.env.covalentKey;
  const url = apiBase + chain + '/address/' + address + '/balances_v2/?nft=true&no-nft-fetch=false&key=' + authKey;
  try {
    const { data } = await axios.get(url);
    const items = data.data.items;
    const resp = { count: 0, assets: [] };
    for (const item of items) {
      const type = item.type;
      if (type === 'nft') {
        resp.count++;
        resp.assets.push(item);
      }
    }
    return resp;
  } catch (err) {
    utils.error('Error occured while fetching assets from covalent');
    utils.error(err);
  }
}

async function getAssetsFromUnmarshal(address, limit, offset) {
  utils.log('Fetching assets from unmarshal');
  const apiBase = 'https://api.unmarshal.com/v1/';
  const chain = 'ethereum';
  const authKey = process.env.unmarshalKey;
  const url = apiBase + chain + '/address/' + address + '/nft-assets?auth_key=' + authKey;
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    utils.error('Error occured while fetching assets from unmarshal');
    utils.error(err);
  }
}

function getAssetsFromOpenseaByOwner(address, limit, offset) {
  return fetchAssetsFromOpensea(
    address,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    offset,
    limit,
    undefined
  );
}

/**
 *
 * @param owner The address of the owner of the assets
 * @param tokenIds An array of token IDs to search for
 * @param assetContractAddress The NFT contract address for the assets
 * @param assetContractAddresses An array of contract addresses to search for
 * @param orderBy How to order the assets returned (sale_date, sale_count, sale_price) defaults to sale_price
 * @param orderDirection asc or desc
 * @param offset
 * @param limit
 * @param collection Limit responses to members of a collection. Case sensitive and must match the collection slug exactly
 */
async function fetchAssetsFromOpensea(
  owner,
  tokenIds,
  assetContractAddress,
  assetContractAddresses,
  orderBy,
  orderDirection,
  offset,
  limit,
  collection
) {
  utils.log('Fetching assets from opensea');
  const authKey = process.env.openseaKey;
  const url = constants.OPENSEA_API + 'assets/';
  const ownerQuery = owner ? { owner } : {};

  const tokenIdsQuery = (tokenIds || []).length > 0 ? { token_ids: tokenIds } : {};
  const assetContractAddressQuery = assetContractAddress ? { asset_contract_address: assetContractAddress } : {};
  const assetContractAddressesQuery =
    (assetContractAddresses || []).length > 0 ? { asset_contract_addresses: assetContractAddresses } : {};

  const isValidOrderByOption = ['sale_date', 'sale_count', 'sale_price'].includes(orderBy);
  const defaultOrderBy = 'sale_price';
  if (orderBy && !isValidOrderByOption) {
    utils.error(`Invalid order by option passed while fetching assets from opensea`);
    orderBy = defaultOrderBy;
  }
  const orderByQuery = orderBy ? { order_by: orderBy } : { order_by: defaultOrderBy };

  const isValidOrderDirection = ['asc', 'desc'].includes(orderDirection);
  const defaultOrderDirection = 'desc';
  if (orderDirection && !isValidOrderDirection) {
    utils.error(`Invalid order direction option passed while fetching assets from opensea`);
    orderDirection = defaultOrderDirection;
  }
  const orderDirectionQuery = orderDirection
    ? { order_direction: orderDirection }
    : { order_direction: defaultOrderDirection };

  const offsetQuery = offset ? { offset } : { offset: 0 };
  // limit is capped at 50
  const limitQuery = limit && limit <= 50 ? { limit } : { limit: 50 };
  const collectionQuery = collection ? { collection } : {};

  const options = {
    headers: {
      'X-API-KEY': authKey
    },
    params: {
      ...ownerQuery,
      ...tokenIdsQuery,
      ...assetContractAddressQuery,
      ...assetContractAddressesQuery,
      ...orderByQuery,
      ...orderDirectionQuery,
      ...offsetQuery,
      ...limitQuery,
      ...collectionQuery
    },
    paramsSerializer: (params) => {
      return qs.stringify(params, { arrayFormat: 'repeat' });
    }
  };

  try {
    const { data } = await axios.get(url, options);
    const assetListingPromises = (data.assets || []).map(async (rawAssetData) => {
      return JSON.parse(await saveRawOpenseaAssetInDatabase(rawAssetData));
    });

    const assetListingPromiseResults = await Promise.allSettled(assetListingPromises);
    const assetListings = assetListingPromiseResults
      .filter((result) => result.status === 'fulfilled')
      .map((fulfilledResult) => fulfilledResult.value);

    return assetListings;
  } catch (err) {
    utils.error('Error occured while fetching assets from opensea');
    utils.error(err);
  }
}

async function saveRawOpenseaAssetInDatabase(rawAssetData) {
  try {
    const assetData = {};
    const marshalledData = await assetDataToListing(rawAssetData);
    assetData.metadata = marshalledData;
    assetData.rawData = rawAssetData;

    const tokenAddress = marshalledData.asset.address.toLowerCase();
    const tokenId = marshalledData.asset.id;
    const newDoc = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(getDocId({ tokenAddress, tokenId, basePrice: '' }));
    await newDoc.set(assetData);
    return getAssetAsListing(newDoc.id, assetData);
  } catch (err) {
    utils.error('Error occured while saving asset data in database');
    utils.error(err);
  }
}

// ============================================= Delete helpers ==========================================================

async function cancelListing(user, batch, docId) {
  utils.log('Canceling listing for user', user);
  try {
    // check if listing exists first
    const listingRef = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.LISTINGS_COLL)
      .doc(docId);
    const doc = await listingRef.get();
    if (!doc.exists) {
      utils.log('No listing ' + docId + ' to delete');
      return;
    }
    // delete
    await deleteListing(batch, listingRef);
  } catch (err) {
    utils.error('Error cancelling listing');
    utils.error(err);
  }
}

async function cancelOffer(user, batch, docId) {
  utils.log('Canceling offer for user', user);
  try {
    // check if offer exists first
    const offerRef = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.OFFERS_COLL)
      .doc(docId);
    const doc = await offerRef.get();
    if (!doc.exists) {
      utils.log('No offer ' + docId + ' to delete');
      return;
    }
    // delete
    await deleteOffer(batch, offerRef);
  } catch (err) {
    utils.error('Error cancelling offer');
    utils.error(err);
  }
}

function isOrderExpired(doc) {
  const order = doc.data();
  const utcSecondsSinceEpoch = Math.round(Date.now() / 1000);
  const orderExpirationTime = +order.expirationTime;
  if (orderExpirationTime === 0) {
    // special case of never expire
    return false;
  }
  return orderExpirationTime <= utcSecondsSinceEpoch;
}

async function checkOwnershipChange(doc) {
  const order = doc.data();
  const side = order.side;
  const schema = order.metadata.schema;
  const address = order.metadata.asset.address;
  const id = order.metadata.asset.id;
  if (side === 1) {
    // listing
    const maker = order.maker;
    if (schema && schema.trim().toLowerCase() === 'erc721') {
      checkERC721Ownership(doc, maker, address, id);
    } else if (schema && schema.trim().toLowerCase() === 'erc1155') {
      checkERC1155Ownership(doc, maker, address, id);
    }
  } else if (side === 0) {
    // offer
    const owner = order.metadata.asset.owner;
    if (schema && schema.trim().toLowerCase() === 'erc721') {
      checkERC721Ownership(doc, owner, address, id);
    } else if (schema && schema.trim().toLowerCase() === 'erc1155') {
      checkERC1155Ownership(doc, owner, address, id);
    }
  }
}

async function checkERC721Ownership(doc, owner, address, id) {
  try {
    const contract = new ethers.Contract(address, erc721Abi, ethersProvider);
    let newOwner = await contract.ownerOf(id);
    newOwner = newOwner.trim().toLowerCase();
    if (newOwner !== constants.NULL_ADDRESS && newOwner !== owner) {
      doc.ref
        .delete()
        .then(() => {
          utils.log('pruned erc721 after ownership change', doc.id, owner, newOwner, address, id);
        })
        .catch((err) => {
          utils.error('Error deleting stale order', doc.id, owner, err);
        });
    }
  } catch (err) {
    utils.error('Checking ERC721 Ownership failed', err);
    if (err && err.message && err.message.indexOf('nonexistent token') > 0) {
      doc.ref
        .delete()
        .then(() => {
          utils.log('pruned erc721 after token id non existent', doc.id, owner, address, id);
        })
        .catch((err) => {
          utils.error('Error deleting nonexistent token id order', doc.id, owner, err);
        });
    }
  }
}

async function checkERC1155Ownership(doc, owner, address, id) {
  try {
    const contract = new ethers.Contract(address, erc1155Abi, ethersProvider);
    const balance = await contract.balanceOf(owner, id);
    if (owner !== constants.NULL_ADDRESS && balance === 0) {
      console.log('stale', owner, owner, address, id);
      doc.ref
        .delete()
        .then(() => {
          console.log('pruned erc1155 after ownership change', doc.id, owner, owner, address, id, balance);
        })
        .catch((err) => {
          console.error('Error deleting', doc.id, owner, err);
        });
    }
  } catch (err) {
    utils.error('Checking ERC1155 Ownership failed', err);
  }
}

async function deleteExpiredOrder(doc) {
  utils.log('Deleting expired order', doc.id);
  const order = doc.data();
  const side = +order.side;
  const batch = db.batch();
  if (side === 1) {
    // listing
    await deleteListing(batch, doc.ref);
  } else if (side === 0) {
    // offer
    await deleteOffer(batch, doc.ref);
  } else {
    utils.error('Unknown order type', doc.id);
  }
  // commit batch
  utils.log('Committing delete expired order batch');
  batch
    .commit()
    .then((resp) => {
      // no op
    })
    .catch((err) => {
      utils.error('Failed to commit delete expired order batch');
      utils.error(err);
    });
}

async function deleteListingWithId(id, user, batch) {
  utils.log('Deleting listing with id', id, 'from user', user);
  const docRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc(id);
  await deleteListing(batch, docRef);
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

async function deleteOfferMadeWithId(id, user, batch) {
  utils.log('Deleting offer with id', id, 'from user', user);
  const docRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.OFFERS_COLL)
    .doc(id);
  await deleteOffer(batch, docRef);
}

async function deleteOffer(batch, docRef) {
  const doc = await docRef.get();
  if (!doc.exists) {
    utils.log('No offer to delete: ' + docRef.id);
    return;
  }
  const offer = doc.id;
  utils.log('Deleting offer', offer);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  // delete offer
  batch.delete(doc.ref);

  // update num user offers
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 0);
}

// =============================================== Rewards calc logic ========================================================

async function hasBonusReward(address) {
  const doc = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
    .doc(address)
    .get();
  return doc.exists;
}

function getEmptyUserProfileInfo() {
  return {
    email: {
      address: '',
      verified: false,
      subscribed: false
    }
  };
}

function getEmptyUserInfo() {
  return {
    numListings: '0',
    numBonusListings: '0',
    numOffers: '0',
    numBonusOffers: '0',
    numPurchases: '0',
    numSales: '0',
    salesTotal: '0',
    salesFeesTotal: '0',
    purchasesTotal: '0',
    purchasesFeesTotal: '0',
    salesTotalNumeric: 0,
    salesFeesTotalNumeric: 0,
    purchasesTotalNumeric: 0,
    purchasesFeesTotalNumeric: 0,
    salesAndPurchasesTotalNumeric: 0,
    rewardsInfo: getEmptyUserRewardInfo()
  };
}

function getEmptyUserRewardInfo() {
  return {
    share: '0',
    bonusShare: '0',
    salesShare: '0',
    purchasesShare: '0',
    rewardDebt: '0',
    bonusRewardDebt: '0',
    saleRewardDebt: '0',
    purchaseRewardDebt: '0',
    pending: '0',
    bonusPending: '0',
    salePending: '0',
    purchasePending: '0',
    grossReward: '0',
    netReward: '0',
    grossRewardNumeric: 0,
    netRewardNumeric: 0,
    openseaVol: 0,
    rewardCalculatedAt: Date.now()
  };
}

async function getReward(user) {
  utils.log('Getting reward for user', user);

  const userRef = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();

  const userOpenseaRef = await db.collection(fstrCnstnts.OPENSEA_COLL).doc(user).get();

  let openseaVol = 0;
  let rewardTier = {};
  let hasAirdrop = false;
  if (userOpenseaRef.exists) {
    openseaVol = userOpenseaRef.get('totalVolUSD');
    rewardTier = getUserRewardTier(openseaVol);
    hasAirdrop = true;
  }

  let userStats = userRef.data();
  userStats = { ...getEmptyUserInfo(), ...userStats };

  let usPerson = types.UsPersonAnswer.none;
  const userProfile = userStats.profileInfo;
  if (userProfile && userProfile.usResidentStatus) {
    usPerson = userProfile.usResidentStatus.usPerson;
  }

  const numListings = bn(userStats.numListings);
  const numBonusListings = bn(userStats.numBonusListings);
  const numOffers = bn(userStats.numOffers);
  const numBonusOffers = bn(userStats.numBonusOffers);
  const numPurchases = bn(userStats.numPurchases);
  const numSales = bn(userStats.numSales);

  const salesTotal = bn(userStats.salesFeesTotal);
  const salesFeesTotal = bn(userStats.salesFeesTotal);
  const salesTotalNumeric = userStats.salesTotalNumeric;
  const salesFeesTotalNumeric = userStats.salesFeesTotalNumeric;

  const purchasesTotal = bn(userStats.purchasesTotal);
  const purchasesFeesTotal = bn(userStats.purchasesFeesTotal);
  const purchasesTotalNumeric = userStats.purchasesTotalNumeric;
  const purchasesFeesTotalNumeric = userStats.purchasesFeesTotalNumeric;

  const doneSoFar = +salesTotalNumeric + +purchasesTotalNumeric;

  // initiate refresh pending txns
  refreshPendingTxns(user);

  const resp = {
    numSales: numSales.toString(),
    numPurchases: numPurchases.toString(),
    salesTotal: salesTotal.toString(),
    salesFeesTotal: salesFeesTotal.toString(),
    salesTotalNumeric,
    salesFeesTotalNumeric,
    purchasesTotal: purchasesTotal.toString(),
    purchasesFeesTotal: purchasesFeesTotal.toString(),
    purchasesTotalNumeric,
    purchasesFeesTotalNumeric,
    numListings: numListings.toString(),
    numBonusListings: numBonusListings.toString(),
    numOffers: numOffers.toString(),
    numBonusOffers: numBonusOffers.toString(),
    hasAirdrop,
    openseaVol,
    rewardTier,
    doneSoFar,
    usPerson
  };

  // write net reward to firestore async for leaderboard purpose
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .set(
      {
        openseaVol: openseaVol,
        rewardCalculatedAt: Date.now()
      },
      { merge: true }
    )
    .catch((err) => {
      utils.error('Error updating reward info for user ' + user);
      utils.error(err);
    });

  return resp;
}

function getUserRewardTier(userVol) {
  const rewardTiers = types.RewardTiers;

  if (userVol >= rewardTiers.t1.min && userVol < rewardTiers.t1.max) {
    return rewardTiers.t1;
  } else if (userVol >= rewardTiers.t2.min && userVol < rewardTiers.t2.max) {
    return rewardTiers.t2;
  } else if (userVol >= rewardTiers.t3.min && userVol < rewardTiers.t3.max) {
    return rewardTiers.t3;
  } else if (userVol >= rewardTiers.t4.min && userVol < rewardTiers.t4.max) {
    return rewardTiers.t4;
  } else if (userVol >= rewardTiers.t5.min && userVol < rewardTiers.t5.max) {
    return rewardTiers.t5;
  } else {
    return null;
  }
}

async function refreshPendingTxns(user) {
  try {
    const limit = 50;

    const snapshot = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.TXNS_COLL)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const missedTxnSnapshot = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.MISSED_TXNS_COLL)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    for (const doc of snapshot.docs) {
      const txn = doc.data();
      // check status
      if (txn.status === 'pending') {
        waitForTxn(user, txn);
      }
    }

    for (const doc of missedTxnSnapshot.docs) {
      const txn = doc.data();
      // check status
      if (txn.status === 'pending') {
        waitForMissedTxn(user, txn);
      }
    }
  } catch (err) {
    utils.error('Error refreshing pending txns');
    utils.error(err);
  }
}

// ==================================================== Email ==============================================================

const nodemailer = require('nodemailer');
const mailCreds = require('./creds/nftc-dev-nodemailer-creds.json');

const senderEmailAddress = 'hi@infinity.xyz';
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    type: 'OAuth2',
    user: senderEmailAddress,
    serviceClient: mailCreds.client_id,
    privateKey: mailCreds.private_key
  }
});

app.get('/u/:user/getEmail', async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();

  if (!user) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  const userDoc = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();

  const data = userDoc.data();

  if (data.profileInfo && data.profileInfo.email && data.profileInfo.email.address) {
    const resp = utils.jsonString(data.profileInfo.email);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
    });
    res.send(resp);
  } else {
    res.send('{}');
  }
});

app.post('/u/:user/setEmail', utils.lowRateLimit, async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const email = (req.body.email || '').trim().toLowerCase();

  if (!user || !email) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  // generate guid
  const guid = crypto.randomBytes(30).toString('hex');

  // store
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .set(
      {
        profileInfo: {
          email: {
            address: email,
            verificationGuid: guid,
            verified: false,
            subscribed: false
          }
        }
      },
      { merge: true }
    )
    .then(() => {
      // send email
      const subject = 'Verify your email for Infinity';
      const link = constants.API_BASE + '/verifyEmail?email=' + email + '&user=' + user + '&guid=' + guid;
      const html =
        '<p>Click the below link to verify your email</p> ' + '<a href=' + link + ' target="_blank">' + link + '</a>';
      sendEmail(email, subject, html);
      res.sendStatus(200);
    })
    .catch((err) => {
      utils.error('Error setting user email for user', user);
      utils.error(err);
      res.sendStatus(500);
    });
});

app.get('/verifyEmail', async (req, res) => {
  // @ts-ignore
  const user = (req.query.user || '').trim().toLowerCase();
  // @ts-ignore
  const email = (req.query.email || '').trim().toLowerCase();
  // @ts-ignore
  const guid = (req.query.guid || '').trim().toLowerCase();

  if (!user || !email || !guid) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  const userDocRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  const userDoc = await userDocRef.get();
  // check email
  const storedEmail = userDoc.data().profileInfo.email.address;
  if (storedEmail !== email) {
    res.status(401).send('Wrong email');
    return;
  }
  // check guid
  const storedGuid = userDoc.data().profileInfo.email.verificationGuid;
  if (storedGuid !== guid) {
    res.status(401).send('Wrong verification code');
    return;
  }
  // all good
  userDocRef
    .set(
      {
        profileInfo: {
          email: {
            verified: true,
            subscribed: true
          }
        }
      },
      { merge: true }
    )
    .then((data) => {
      res.sendStatus(200);
    })
    .catch((err) => {
      utils.error('Verifying email failed');
      utils.error(err);
      res.sendStatus(500);
    });
});

app.post('/u/:user/subscribeEmail', utils.lowRateLimit, async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const data = req.body;

  if (!user || Object.keys(data).length === 0) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  const isSubscribed = data.subscribe;
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .set(
      {
        profileInfo: {
          email: {
            subscribed: isSubscribed
          }
        }
      },
      { merge: true }
    )
    .then(() => {
      res.send({ subscribed: isSubscribed });
    })
    .catch((err) => {
      utils.error('Subscribing email failed');
      utils.error(err);
      res.sendStatus(500);
    });
});

// right now emails are sent when an item is purchased, offer is made or an offer is accepted
async function prepareEmail(user, order, type) {
  utils.log('Preparing to send email to user', user, 'for action type', type);
  const userDoc = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();

  let profileInfo = getEmptyUserProfileInfo();

  if (userDoc.data()) {
    profileInfo = {
      ...profileInfo,
      ...userDoc.data().profileInfo
    };
  }

  const email = profileInfo.email.address;
  const verified = profileInfo.email.verified;
  const subscribed = profileInfo.email.subscribed;
  if (!email || !verified || !subscribed) {
    utils.log('Not sending email as it is not verfied or subscribed or not found');
    return;
  }

  const price = order.metadata.basePriceInEth;

  let subject = '';
  let link = constants.SITE_BASE;
  if (type === 'offerMade') {
    subject = 'You received a ' + price + ' ETH offer at Infinity';
    link += '/offers-received';
  } else if (type === 'offerAccepted') {
    subject = 'Your offer of ' + price + ' ETH has been accepted at Infinity';
    link += '/purchases';
  } else if (type === 'itemPurchased') {
    subject = 'Your item has been purchased for ' + price + ' ETH at Infinity';
    link += '/sales';
  } else {
    utils.error('Cannot prepare email for unknown action type');
    return;
  }

  const html = '<p>See it here:</p> ' + '<a href=' + link + ' target="_blank">' + link + '</a>';
  // send email
  sendEmail(email, subject, html);
}

function sendEmail(to, subject, html) {
  utils.log('Sending email to', to);

  const mailOptions = {
    from: senderEmailAddress,
    to,
    subject,
    html
  };

  transporter.sendMail(mailOptions).catch((err) => {
    utils.error('Error sending email');
    utils.error(err);
  });
}

// =========================================================== Profile ==================================================

app.post('/u/:user/usperson', utils.lowRateLimit, async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { usPerson } = req.body;

  let usPersonValue = '';
  if (usPerson) {
    usPersonValue = types.UsPersonAnswer[usPerson];
  }

  if (!user || !usPersonValue) {
    utils.error('Invalid input');
    res.sendStatus(500);
    return;
  }

  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .set(
      {
        profileInfo: {
          usResidentStatus: {
            usPerson: usPersonValue,
            answeredAt: Date.now()
          }
        }
      },
      { merge: true }
    )
    .then(() => {
      res.send({ usPerson: usPersonValue });
    })
    .catch((err) => {
      utils.error('Setting US person status failed');
      utils.error(err);
      res.sendStatus(500);
    });
});

// ============================================================ Misc ======================================================

async function isTokenVerified(address) {
  const tokenAddress = address.trim().toLowerCase();
  const doc = await db.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(tokenAddress).get();
  if (doc.exists) {
    const hasBlueCheck = doc.get('hasBlueCheck');
    if (hasBlueCheck) {
      return true;
    }
  }
  return false;
}

function getSearchFriendlyString(input) {
  if (!input) {
    return '';
  }
  // remove spaces, dashes and underscores only
  const output = input.replace(/[\s-_]/g, '');
  return output.toLowerCase();
}

function toFixed5(num) {
  // @ts-ignore
  // eslint-disable-next-line no-undef
  // console.log(__line);
  return +bn(num).toFixed(5);
  // return +num.toString().match(/^-?\d+(?:\.\d{0,5})?/)[0];
}

function bn(num) {
  // @ts-ignore
  const bigNum = BigNumber(num);
  // console.log(num + '   ====== bigNUm ' + bigNum);
  // console.log(__line);
  return bigNum;
}

// eslint-disable-next-line no-unused-vars
function getDocId({ tokenAddress, tokenId, basePrice }) {
  const data = tokenAddress.trim() + tokenId.trim() + basePrice;
  const id = crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  utils.log('Doc id for token address ' + tokenAddress + ' and token id ' + tokenId + ' is ' + id);
  return id;
}
