require('dotenv').config();
const { ethers } = require('ethers');
const ethersProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);

const BigNumber = require('bignumber.js');
const express = require('express');
const helmet = require('helmet');
const axios = require('axios').default;
const crypto = require('crypto');
const utils = require('./utils');
const types = require('./types');

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
  3: 'alchemy'
};
const DEFAULT_ITEMS_PER_PAGE = 50;
const DEFAULT_MIN_ETH = 0.0000001;
const DEFAULT_MAX_ETH = 1000000; // for listings
const DEFAULT_PRICE_SORT_DIRECTION = 'desc';

const listingsByCollCache = types.listingsByCollCache;

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
    res.send(resp);
  } catch (err) {
    utils.error('Error in checking whether token: ' + tokenAddress + ' is verified or has bonus');
    utils.error(err);
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
  const { tokenId } = req.query;
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
  const pageNum = +(req.query.lastItemPageNum || 0);

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
  } else if (collectionName || priceMin || priceMax) {
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
      startAfterPrice,
      startAfterMillis,
      limit
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  } else {
    resp = await getListingsByCollection(startAfterBlueCheck, startAfterSearchCollectionName, pageNum);
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
    const data = await db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.asset.address', '==', tokenAddress)
      .limit(limit) // should only be one but to catch errors
      .get();

    return getOrdersResponse(data);
  } catch (err) {
    utils.error('Failed to get listing by tokend address and id', tokenAddress, tokenId);
    utils.error(err);
  }
}

async function getListingsByCollection(startAfterBlueCheck, startAfterSearchCollectionName, pageNum) {
  let resp = getCachedData(startAfterBlueCheck, startAfterSearchCollectionName, pageNum);
  if (resp) {
    return utils.jsonString(resp);
  }

  // if cache expired or not present
  utils.log('Fetching listings by collection from firestore as cache expired or does not exist for page', pageNum);
  const listings = await getListingsByCollFromFirestore(startAfterBlueCheck, startAfterSearchCollectionName, pageNum);
  // set cache for this page
  if (pageNum < listingsByCollCache.numPages) {
    if (!listingsByCollCache[pageNum]) {
      listingsByCollCache[pageNum] = { updatedAt: 0, listings: [] };
    }
    listingsByCollCache[pageNum].updatedAt = Date.now();
    listingsByCollCache[pageNum].listings = listings;
  }

  // prefetch next page async
  const lastListing = listings[listings.length - 1];
  preFetchNextPages(lastListing, pageNum);

  // return response
  resp = {
    count: listings.length,
    listings
  };
  return utils.jsonString(resp);
}

function getCachedData(startAfterBlueCheck, startAfterSearchCollectionName, pageNum) {
  let resp;
  if (pageNum < listingsByCollCache.numPages) {
    // if cache exists
    if (listingsByCollCache[pageNum]) {
      const cacheTimeoutMs = listingsByCollCache.cacheTimeoutMs;
      const cacheTimeRemaining = Date.now() - listingsByCollCache[pageNum].updatedAt;
      if (cacheTimeRemaining < cacheTimeoutMs) {
        utils.log('Fetching listings by collection from server cache for page', pageNum);
        resp = {
          count: listingsByCollCache[pageNum].listings.length,
          listings: listingsByCollCache[pageNum].listings
        };
      }

      // prefetch if elapsed time is close async
      if (Math.floor(cacheTimeoutMs / 2) < cacheTimeRemaining) {
        utils.log('Prefetching listings by collection since cache expiry is close for page', pageNum);
        getListingsByCollFromFirestore(startAfterBlueCheck, startAfterSearchCollectionName, pageNum).then(
          (preFetchedListings) => {
            listingsByCollCache[pageNum].updatedAt = Date.now();
            listingsByCollCache[pageNum].listings = preFetchedListings;
          }
        );
      }

      // prefetch next page if not already exists in cache async
      const nextPageNum = pageNum + 1;
      if (nextPageNum < listingsByCollCache.numPages) {
        const nextCache = listingsByCollCache[nextPageNum];
        if (!nextCache) {
          const listings = listingsByCollCache[pageNum].listings;
          const lastListing = listings[listings.length - 1];
          preFetchNextPages(lastListing, pageNum);
        }
      }
    }
  }
  return resp;
}

async function preFetchNextPages(lastListing, pageNum) {
  const numPages = listingsByCollCache.numPreFetchPages;
  for (let i = 1; i <= numPages; i++) {
    const nextPageNum = pageNum + i;
    if (nextPageNum < listingsByCollCache.numPages) {
      utils.log('Prefetching next page for listings by collection with pageNum', nextPageNum);
      const nextCache = listingsByCollCache[nextPageNum];
      if (nextCache) {
        lastListing = nextCache.listings[nextCache.listings.length - 1];
      } else {
        if (lastListing && lastListing.metadata && lastListing.metadata.asset) {
          // eslint-disable-next-line no-unneeded-ternary
          const newStartAfterBlueCheck = lastListing.metadata.hasBlueCheck;
          const newStartAfterSearchCollectionName = lastListing.metadata.asset.searchCollectionName;
          const preFetchedListings = await getListingsByCollFromFirestore(
            newStartAfterBlueCheck,
            newStartAfterSearchCollectionName,
            nextPageNum
          );
          utils.log('Updating cache with prefetched next page data for page num', nextPageNum);
          listingsByCollCache[nextPageNum] = { updatedAt: 0, listings: [] };
          listingsByCollCache[nextPageNum].updatedAt = Date.now();
          listingsByCollCache[nextPageNum].listings = preFetchedListings;
          lastListing = preFetchedListings[preFetchedListings.length - 1];
        }
      }
    }
  }
}

async function getListingsByCollFromFirestore(startAfterBlueCheck, startAfterSearchCollectionName, pageNum) {
  const listings = [];
  const pageSize = listingsByCollCache.pageSize;
  let startAfterBlueCheckBool = true;
  if (startAfterBlueCheck !== undefined) {
    startAfterBlueCheckBool = startAfterBlueCheck === 'true';
  }
  try {
    for (let i = 0; i < pageSize; i++) {
      const query = db
        .collectionGroup(fstrCnstnts.LISTINGS_COLL)
        .orderBy('metadata.hasBlueCheck', 'desc')
        .orderBy('metadata.asset.searchCollectionName', 'asc')
        .startAfter(startAfterBlueCheckBool, startAfterSearchCollectionName);

      const snapshot = await query.limit(1).get();
      if (snapshot.docs.length > 0) {
        const listing = snapshot.docs[0].data();
        if (listing && listing.metadata && listing.metadata.asset) {
          listing.id = snapshot.docs[0].id;
          listing.metadata.pageNum = pageNum + 1; // next page
          // eslint-disable-next-line no-unneeded-ternary
          startAfterBlueCheckBool = listing.metadata.hasBlueCheck ? true : false;
          startAfterSearchCollectionName = listing.metadata.asset.searchCollectionName;
          listings.push(listing);
        }
      }
    }
    return listings;
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
  startAfterPrice,
  startAfterMillis,
  limit
) {
  try {
    utils.log('Getting listings of a collection');

    let queryRef = db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.basePriceInEth', '>=', +priceMin)
      .where('metadata.basePriceInEth', '<=', +priceMax);
    if (collectionName) {
      queryRef = queryRef.where('metadata.asset.searchCollectionName', '==', getSearchFriendlyString(collectionName));
    }
    queryRef = queryRef
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', 'desc')
      .startAfter(startAfterPrice, startAfterMillis)
      .limit(limit);

    const data = await queryRef.get();
    return getOrdersResponse(data);
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

// fetch items bought by user
app.get('/u/:user/purchases', async (req, res) => {
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
    .collection(fstrCnstnts.PURCHASES_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterMillis)
    .limit(limit)
    .get()
    .then((data) => {
      const purchases = [];
      for (const doc of data.docs) {
        const purchase = doc.data();
        purchase.id = doc.id;
        purchases.push(purchase);
      }
      const resp = {
        count: purchases.length,
        purchases: purchases
      };
      const respStr = utils.jsonString(resp);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=30',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get items bought by user ' + user);
      utils.error(err);
      res.sendStatus(500);
    });
});

// fetch items sold by user
app.get('/u/:user/sales', async (req, res) => {
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
    .collection(fstrCnstnts.SALES_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterMillis)
    .limit(limit)
    .get()
    .then((data) => {
      const sales = [];
      for (const doc of data.docs) {
        const sale = doc.data();
        sale.id = doc.id;
        sales.push(sale);
      }
      const resp = {
        count: sales.length,
        sales: sales
      };
      const respStr = utils.jsonString(resp);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=30',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get items sold by user ' + user);
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
    res.send(resp);
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

        res.send(resp);
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
      .select('metadata.asset.collectionName', 'metadata.hasBlueCheck')
      .limit(10)
      .get()
      .then((data) => {
        // to enable cdn cache
        let resp = data.docs.map((doc) => {
          return {
            collectionName: doc.data().metadata.asset.collectionName,
            hasBlueCheck: doc.data().metadata.hasBlueCheck
          };
        });
        // remove duplicates and take only the first 10 results
        resp = utils.getUniqueItemsByProperties(resp, 'collectionName');
        const respStr = utils.jsonString(resp);
        res.set({
          'Cache-Control': 'must-revalidate, max-age=60',
          'Content-Length': Buffer.byteLength(respStr, 'utf8')
        });
        res.send(resp);
      })
      .catch((err) => {
        utils.error('Failed to get collection names', err);
        res.sendStatus(500);
      });
  } else {
    res.send(utils.jsonString([]));
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
    res.send(resp);
  } catch (err) {
    utils.error('Failed to get pending txns of user ' + user);
    utils.error(err);
    res.sendStatus(500);
  }
});

// =============================================== POSTS =====================================================================

app.post('/verifiedTokens', async (req, res) => {
  const { startAfterName, limit } = req.body;

  try {
    let query = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.VERIFIED_TOKENS_COLL)
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
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
    });
    res.send(resp);
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

app.post('/verifiedCollections', async (req, res) => {
  const { startAfterName, limit } = req.body;

  try {
    let query = db.collection(fstrCnstnts.VERIFIED_COLLECTIONS_COLL).orderBy('name', 'asc');

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
      'Cache-Control': 'must-revalidate, max-age=30',
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
    const { isValid, from, buyer, seller, value, timestamp } = await getTxnData(txnHash, actionType);
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
        waitForTxn(user, doc.data());
        res.sendStatus(200);
        return;
      } else {
        // txn is valid but it doesn't exist in firestore
        // we write to firestore
        utils.log('Txn', txnHash, 'is valid but it doesnt exist in firestore');
        const batch = db.batch();
        const valueInEth = ethers.utils.parseEther(value + '');

        const txnPayload = {
          txnHash,
          status: 'pending',
          salePriceInEth: valueInEth,
          actionType,
          createdAt: timestamp,
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
          });
      }
    }
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
  let timestamp = 0;
  const txn = await ethersProvider.getTransaction(txnHash);
  if (txn) {
    timestamp = txn.timestamp;
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
  return { isValid, from, buyer, seller, value, timestamp };
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
          utils.log('Txn: ' + origTxnHash + ' confirmed after ' + confirms + ' block(s)');
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
  utils.log('Committing the big `wait for txn` batch to firestore');
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
        const status = txnDoc.get('status');
        if (status === 'pending') {
          // orig txn confirmed
          utils.log('Txn: ' + txnHash + ' confirmed after ' + confirms + ' block(s)');
          const txnData = JSON.parse(utils.jsonString(receipt));
          const txnSuceeded = txnData.status === 1;
          const updatedStatus = txnSuceeded ? 'confirmed' : 'failed';
          await txn.update(txnDocRef, { status: updatedStatus, txnData });
          return txnSuceeded;
        } else {
          return false;
        }
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
          utils.log('Updating purchase and sale data for missed txn', txnHash, ' in firestore');
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
  const listings = [];
  for (const doc of data.docs) {
    const listing = doc.data();
    const isExpired = isOrderExpired(doc);
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
  const respStr = utils.jsonString(resp);
  return respStr;
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
      data = await getAssetsFromOpensea(address, limit, offset);
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

async function getAssetsFromOpensea(address, limit, offset) {
  utils.log('Fetching assets from opensea');
  const apiBase = 'https://api.opensea.io/api/v1/assets/';
  const authKey = process.env.openseaKey;
  const url = apiBase + '?limit=' + limit + '&offset=' + offset + '&owner=' + address;
  const options = {
    headers: {
      'X-API-KEY': authKey
    }
  };
  try {
    utils.trace(url);
    const { data } = await axios.get(url, options);
    return data;
  } catch (err) {
    utils.error('Error occured while fetching assets from opensea');
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
  const doc = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.VERIFIED_TOKENS_COLL)
    .doc(tokenAddress)
    .get();
  return doc.exists;
}

function getSearchFriendlyString(input) {
  const noSpace = input.replace(/\s/g, '');
  return noSpace.toLowerCase();
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
