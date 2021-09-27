require('dotenv').config();
const { ethers } = require('ethers');
const ethersProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);

const BigNumber = require('bignumber.js');
const express = require('express');
const axios = require('axios').default;
const crypto = require('crypto');
const app = express();
const cors = require('cors');
app.use(express.json());
app.use(cors());

const utils = require('./utils');
const constants = require('./constants');
const fstrCnstnts = constants.firestore;

const firebaseAdmin = utils.getFirebaseAdmin();
const db = firebaseAdmin.firestore();

const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB_NAME,
  password: process.env.PG_PASS,
  port: parseInt(process.env.PG_PORT)
});

const nftDataSources = {
  0: 'nftc',
  1: 'opensea',
  2: 'unmarshal',
  3: 'alchemy'
};
const DEFAULT_ITEMS_PER_PAGE = 50;
// const DEFAULT_MIN_ETH = 0.0000001;
const DEFAULT_MAX_ETH = 10000; // for listings
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
  const tokenAddress = req.params.tokenAddress.trim().toLowerCase();
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
*/
app.get('/listings', async (req, res) => {
  const tokenId = req.query.tokenId;
  // @ts-ignore
  const tokenAddress = req.query.tokenAddress.trim().toLowerCase();
  // @ts-ignore
  const collectionName = req.query.collectionName.trim(); // preserve case
  const priceMin = +req.query.priceMin;
  const priceMax = +req.query.priceMax;
  const sortByPriceDirection = `${req.query.sortByPrice}`.toLowerCase() || DEFAULT_PRICE_SORT_DIRECTION;
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
  } else if (collectionName || priceMin || priceMax) {
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
    resp = await getAllListings(sortByPriceDirection, startAfterPrice, startAfterMillis, limit);
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
      queryRef = queryRef.where('metadata.asset.collectionName', '==', collectionName);
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

async function getAllListings(sortByPriceDirection, startAfterPrice, startAfterMillis, limit) {
  utils.log('Getting all listings');

  try {
    const data = await db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', 'desc')
      .startAfter(startAfterPrice, startAfterMillis)
      .limit(limit)
      .get();

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
  const user = req.params.user.trim().toLowerCase();
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
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
  const user = req.params.user.trim().toLowerCase();
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
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
  const user = req.params.user.trim().toLowerCase();
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
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
  const user = req.params.user.trim().toLowerCase();
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
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
  const user = req.params.user.trim().toLowerCase();
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
  // query: id, maker, side
  let docId;

  if (req.query.id) {
    // @ts-ignore
    docId = req.query.id.trim(); // preserve case
  }

  if (docId && docId.length > 0) {
    return getOrdersWithDocId(req, res);
  }

  return getOrdersWithTokenId(req, res);
});

// TODO: refactor: don't pass the whole "req" or "res" => pass { vars... } instead.
const getOrdersWithDocId = async (req, res) => {
  if (!req.query.maker || !req.query.id) {
    res.sendStatus(400);
    return;
  }

  const maker = req.query.maker.trim().toLowerCase();
  const docId = req.query.id.trim(); // preserve case
  const side = +req.query.side;
  let collection = fstrCnstnts.LISTINGS_COLL;
  try {
    if (side === 0) {
      collection = fstrCnstnts.OFFERS_COLL;
    }
    const doc = await db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(maker)
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
    utils.error('Error fetching order: ' + docId + ' for user ' + maker + ' from collection ' + collection);
    utils.error(err);
    res.sendStatus(500);
  }
};

const getOrdersWithTokenId = async (req, res) => {
  if (!req.query.maker || !req.query.tokenAddress) {
    res.sendStatus(400);
  }

  const maker = req.query.maker.trim().toLowerCase();
  const tokenAddress = req.query.tokenAddress.trim().toLowerCase();
  const tokenId = req.query.tokenId;
  const side = +req.query.side;

  const docs = await getOrders(maker, tokenAddress, tokenId, side);
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
app.get('/u/:user/reward', async (req, res) => {
  const user = req.params.user.trim().toLowerCase();
  try {
    const resp = await getReward(user);
    const respStr = utils.jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=300',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(resp);
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// fetch rewards leaderboard
app.get('/rewards/leaderboard', async (req, res) => {
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .orderBy('rewardsInfo.netRewardNumeric', 'desc')
    .limit(10)
    .get()
    .then((data) => {
      const results = [];
      for (const doc of data.docs) {
        const result = doc.data();
        result.id = doc.id;
        results.push(result);
      }
      const resp = {
        count: results.length,
        results: results
      };
      const respStr = utils.jsonString(resp);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=600',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get leaderboard');
      utils.error(err);
      res.sendStatus(500);
    });
});

app.get('/titles', async (req, res) => {
  const startsWithOrig = req.query.startsWith;
  const startsWith = getSearchFriendlyString(startsWithOrig);
  if (typeof startsWith === 'string') {
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
          'Cache-Control': 'must-revalidate, max-age=600',
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
  if (typeof startsWith === 'string') {
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
          'Cache-Control': 'must-revalidate, max-age=600',
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
  const user = req.params.user.trim().toLowerCase();
  const { limit, startAfterMillis, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (error) {
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
    const resp = {
      count: txns.length,
      listings: txns
    };
    const respStr = utils.jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
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

// post a listing or make offer
app.post('/u/:user/wyvern/v1/orders', async (req, res) => {
  const payload = req.body;
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  const maker = req.params.user.trim().toLowerCase();
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
app.post('/u/:user/wyvern/v1/txns', async (req, res) => {
  try {
    const payload = req.body;
    const user = req.params.user.trim().toLowerCase();

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
      res.status(500).send(inputError);
      return;
    }

    // check if valid nftc txn
    // txn would be null for recently sent txns
    // taking optimistic approach of assuming this would be a valid txn
    const isValid = await isValidNftcTxn(txnHash, true);
    if (!isValid) {
      utils.error('Invalid txn', txnHash);
      res.status(500).send('Invalid txn: ' + txnHash);
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

// ====================================================== Write helpers ==========================================================

const openseaAbi = require('./abi/openseaExchangeContract.json');

async function isValidNftcTxn(txnHash, isOptimistic) {
  let isValid = isOptimistic;
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
    if (args && args.length > 0) {
      const addresses = args[0];
      if (addresses && addresses.length === 14) {
        const buyFeeRecipient = args[0][3];
        const sellFeeRecipient = args[0][10];
        if (
          buyFeeRecipient.toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase() &&
          sellFeeRecipient.toLowerCase() !== constants.NFTC_FEE_ADDRESS.toLowerCase()
        ) {
          isValid = false;
        }
      } else {
        isValid = false;
      }
    } else {
      isValid = false;
    }
    if (to.toLowerCase() !== constants.WYVERN_EXCHANGE_ADDRESS.toLowerCase()) {
      isValid = false;
    }
    if (chainId !== constants.ETH_CHAIN_ID) {
      isValid = false;
    }
    if (functionName !== constants.WYVERN_ATOMIC_MATCH_FUNCTION) {
      isValid = false;
    }
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
    const receipt = await ethersProvider.waitForTransaction(origTxnHash, confirms);

    // check if valid nftc txn
    const isValid = await isValidNftcTxn(origTxnHash, false);
    if (!isValid) {
      utils.error('Invalid NFTC txn', origTxnHash);
      return;
    }

    // check if txn status is not already updated in firestore by another call - (from the get txns method for instance)
    try {
      const isUpdated = await db.runTransaction(async (txn) => {
        const txnDoc = await txn.get(origTxnDocRef);
        const status = txnDoc.get('status');
        if (status === 'pending') {
          // orig txn confirmed
          utils.log('Txn: ' + origTxnHash + ' confirmed after ' + confirms + ' block(s)');
          const txnData = JSON.parse(utils.jsonString(receipt));
          await txn.update(origTxnDocRef, { status: 'confirmed', txnData });
          return true;
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

  // update rewards first; before stats
  const userInfo = await getUserInfoAndUpdateUserRewards(
    user,
    false,
    numOrders,
    purchaseFees,
    salePriceInEth,
    true,
    'purchase'
  );

  // update user txn stats
  // @ts-ignore
  const purchasesTotal = bn(userInfo.purchasesTotal).plus(salePriceInEth).toString();
  // @ts-ignore
  const purchasesFeesTotal = bn(userInfo.purchasesFeesTotal).plus(purchaseFees).toString();
  const purchasesTotalNumeric = toFixed5(purchasesTotal);
  const purchasesFeesTotalNumeric = toFixed5(purchasesFeesTotal);

  utils.trace(
    'User purchases total',
    purchasesTotal,
    'purchases fees total',
    purchasesFeesTotal,
    'purchases total numeric',
    purchasesTotalNumeric,
    'purchases fees total numeric',
    purchasesFeesTotalNumeric
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
      purchasesFeesTotalNumeric
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
  // update rewards first; before stats
  const userInfo = await getUserInfoAndUpdateUserRewards(
    user,
    false,
    numOrders,
    feesInEth,
    salePriceInEth,
    true,
    'sale'
  );

  // update user txn stats
  // @ts-ignore
  const salesTotal = bn(userInfo.salesTotal).plus(salePriceInEth).toString();
  // @ts-ignore
  const salesFeesTotal = bn(userInfo.salesFeesTotal).plus(feesInEth).toString();
  const salesTotalNumeric = toFixed5(salesTotal);
  const salesFeesTotalNumeric = toFixed5(salesFeesTotal);

  utils.trace(
    'User sales total',
    salesTotal,
    'sales fees total',
    salesFeesTotal,
    'sales total numeric',
    salesTotalNumeric,
    'sales fees total numeric',
    salesFeesTotalNumeric
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
      salesFeesTotalNumeric
    },
    { merge: true }
  );
}

async function postListing(maker, payload, batch, numOrders, hasBonus) {
  utils.log('Writing listing to firestore for user + ' + maker);
  // check if token is verified if payload instructs so
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  let blueCheck = payload.metadata.hasBlueCheck;
  if (payload.metadata.checkBlueCheck) {
    blueCheck = await isTokenVerified(tokenAddress);
  }
  payload.metadata.hasBlueCheck = blueCheck;
  payload.metadata.createdAt = Date.now();

  // update rewards
  getUserInfoAndUpdateUserRewards(maker, hasBonus, numOrders, 0, 0, true, 'list');

  // write listing
  const listingRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc();

  batch.set(listingRef, payload, { merge: true });

  // update num user listings
  updateNumOrders(batch, maker, numOrders, hasBonus, 1);
}

async function postOffer(maker, payload, batch, numOrders, hasBonus) {
  utils.log('Writing offer to firestore for user', maker);
  const taker = payload.metadata.asset.owner.trim().toLowerCase();
  payload.metadata.createdAt = Date.now();

  // update rewards
  getUserInfoAndUpdateUserRewards(maker, hasBonus, numOrders, 0, 0, true, 'offer');

  // store data in offers of maker
  const offerRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.OFFERS_COLL)
    .doc();
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
  const user = req.params.user.trim().toLowerCase();
  const { source } = req.query;
  const { limit, offset, error } = utils.parseQueryFields(res, req, ['limit', 'offset'], ['50', `0`]);
  if (error) {
    return;
  }
  const sourceName = nftDataSources[source];
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
    utils.log('No listing to delete: ' + docRef);
    return;
  }
  const listing = doc.id;
  utils.log('Deleting listing', listing);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  getUserInfoAndUpdateUserRewards(user, hasBonus, numOrders, 0, 0, false, 'list');

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
    utils.log('No offer to delete: ' + docRef);
    return;
  }
  const offer = doc.id;
  utils.log('Deleting offer', offer);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  getUserInfoAndUpdateUserRewards(user, hasBonus, numOrders, 0, 0, false, 'offer');

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

async function getUserInfoAndUpdateUserRewards(
  user,
  hasBonus,
  numOrders,
  feesInEth,
  salePriceInEth,
  isIncrease,
  actionType
) {
  utils.log('Getting UserInfo and updated reward for user', user);

  const userInfoRef = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  const userInfo = { ...getEmptyUserInfo(), ...userInfoRef.data() };
  userInfo.rewardsInfo = {
    ...getEmptyUserRewardInfo(),
    ...userInfo.rewardsInfo
  };

  updateRewards(user, hasBonus, numOrders, bn(feesInEth), bn(salePriceInEth), isIncrease, actionType);

  return userInfo;
}

function getEmptyGlobalInfo() {
  return {
    totalListings: '0',
    totalBonusListings: '0',
    totalOffers: '0',
    totalBonusOffers: '0',
    totalSales: '0',
    totalFees: '0',
    totalVolume: '0',
    rewardsInfo: {
      totalShare: '0',
      totalBonusShare: '0',
      totalFeesShare: '0',
      accRewardPerShare: '0',
      accBonusRewardPerShare: '0',
      accSaleRewardPerShare: '0',
      accPurchaseRewardPerShare: '0',
      rewardPerBlock: '0',
      bonusRewardPerBlock: '0',
      saleRewardPerBlock: '0',
      purchaseRewardPerBlock: '0',
      totalRewardPaid: '0',
      totalBonusRewardPaid: '0',
      totalSaleRewardPaid: '0',
      totalPurchaseRewardPaid: '0',
      lastRewardBlock: '0',
      penaltyActivated: true,
      penaltyRatio: '0.99'
    }
  };
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
    rewardCalculatedAt: Date.now()
  };
}

// updates totalRewardPaid, totalBonusRewardPaid, totalSaleRewardPaid, totalPurchaseRewardPaid and returns updated user rewards
async function updateRewards(user, hasBonus, numOrders, feesInEth, salePriceInEth, isIncrease, actionType) {
  try {
    const client = await pool.connect();
    const currentBlock = await getCurrentBlock();
    try {
      // run txn
      await client.query('BEGIN');
      const table = process.env.PG_REWARDS_TABLE;
      const globalInfoId = 'globalInfo';

      const selectQuery = 'SELECT data FROM ' + table + ' WHERE id = $1';
      const insertQuery = 'INSERT INTO ' + table + '(id, data) VALUES($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2';

      let globalInfo = {};
      const res = await client.query(selectQuery, [globalInfoId]);
      if (res.rowCount === 1) {
        globalInfo = res.rows[0].data;
      }
      globalInfo = { ...getEmptyGlobalInfo(), ...globalInfo };
      globalInfo.rewardsInfo = {
        ...getEmptyGlobalInfo().rewardsInfo,
        ...globalInfo.rewardsInfo
      };

      let userInfo = {};
      const result = await client.query(selectQuery, [user]);
      if (result.rowCount === 1) {
        userInfo = result.rows[0].data;
      }
      userInfo = { ...getEmptyUserInfo(), ...userInfo };
      userInfo.rewardsInfo = {
        ...getEmptyUserInfo().rewardsInfo,
        ...userInfo.rewardsInfo
      };

      // updating rewards
      utils.log(
        'Updating rewards in increasing mode',
        isIncrease,
        'with hasBonus',
        hasBonus,
        'numOrders',
        numOrders,
        'fees',
        feesInEth,
        'salePrice',
        salePriceInEth,
        'actionType',
        actionType
      );

      let userShare = bn(userInfo.rewardsInfo.share);
      let userBonusShare = bn(userInfo.rewardsInfo.bonusShare);
      let salesShare = bn(userInfo.rewardsInfo.salesShare);
      let purchasesShare = bn(userInfo.rewardsInfo.purchasesShare);

      const rewardDebt = bn(userInfo.rewardsInfo.rewardDebt);
      const bonusRewardDebt = bn(userInfo.rewardsInfo.bonusRewardDebt);
      const saleRewardDebt = bn(userInfo.rewardsInfo.saleRewardDebt);
      const purchaseRewardDebt = bn(userInfo.rewardsInfo.purchaseRewardDebt);

      let pending = bn(0);
      let bonusPending = bn(0);
      let salePending = bn(0);
      let purchasePending = bn(0);

      const isOrder = actionType === 'offer' || actionType === 'list';
      const isSale = actionType === 'sale';
      const isPurchase = actionType === 'purchase';

      const totalShare = bn(globalInfo.rewardsInfo.totalShare);
      const totalBonusShare = bn(globalInfo.rewardsInfo.totalBonusShare);
      const totalFeesShare = bn(globalInfo.rewardsInfo.totalFeesShare);

      const rewardPerBlock = bn(globalInfo.rewardsInfo.rewardPerBlock);
      const bonusRewardPerBlock = bn(globalInfo.rewardsInfo.bonusRewardPerBlock);
      const saleRewardPerBlock = bn(globalInfo.rewardsInfo.saleRewardPerBlock);
      const purchaseRewardPerBlock = bn(globalInfo.rewardsInfo.purchaseRewardPerBlock);

      let accRewardPerShare = bn(globalInfo.rewardsInfo.accRewardPerShare);
      let accBonusRewardPerShare = bn(globalInfo.rewardsInfo.accBonusRewardPerShare);
      let accSaleRewardPerShare = bn(globalInfo.rewardsInfo.accSaleRewardPerShare);
      let accPurchaseRewardPerShare = bn(globalInfo.rewardsInfo.accPurchaseRewardPerShare);

      let updatedGlobalRewards = {};
      let updatedGlobalInfo = {};

      // update acc reward per shares only once per block
      const lastRewardBlock = bn(globalInfo.rewardsInfo.lastRewardBlock);
      if (currentBlock.lte(lastRewardBlock)) {
        utils.log(
          'Not updating acc reward per shares since current block:',
          currentBlock.toString(),
          '<= lastRewardBlock:',
          lastRewardBlock.toString()
        );
      } else {
        updatedGlobalRewards.lastRewardBlock = currentBlock.toString();

        const multiplier = currentBlock.minus(lastRewardBlock);
        utils.trace('Reward multiplier:', multiplier);
        if (totalShare.gt(0)) {
          const reward = multiplier.times(rewardPerBlock);
          accRewardPerShare = accRewardPerShare.plus(reward.div(totalShare));
          updatedGlobalRewards.accRewardPerShare = accRewardPerShare.toString();

          utils.trace('Total share:', totalShare.toString());
          utils.trace('Updated accRewardPerShare to:', accRewardPerShare.toString());
        }
        if (totalBonusShare.gt(0)) {
          const bonusReward = multiplier.times(bonusRewardPerBlock);
          accBonusRewardPerShare = accBonusRewardPerShare.plus(bonusReward.div(totalBonusShare));
          updatedGlobalRewards.accBonusRewardPerShare = accBonusRewardPerShare.toString();

          utils.trace('Total bonus share:', totalBonusShare.toString());
          utils.trace('Updated accBonusRewardPerShare to:', accBonusRewardPerShare.toString());
        }
        if (totalFeesShare.gt(0)) {
          const saleReward = multiplier.times(saleRewardPerBlock);
          accSaleRewardPerShare = accSaleRewardPerShare.plus(saleReward.div(totalFeesShare));
          updatedGlobalRewards.accSaleRewardPerShare = accSaleRewardPerShare.toString();

          const purchaseReward = multiplier.times(purchaseRewardPerBlock);
          accPurchaseRewardPerShare = accPurchaseRewardPerShare.plus(purchaseReward.div(totalFeesShare));
          updatedGlobalRewards.accPurchaseRewardPerShare = accPurchaseRewardPerShare.toString();

          utils.trace('Total fees share:', totalFeesShare.toString());
          utils.trace('Updated accSaleRewardPerShare to:', accSaleRewardPerShare.toString());
          utils.trace('Updated accPurchaseRewardPerShare to:', accPurchaseRewardPerShare.toString());
        }
      }

      utils.log('Updating user pending and reward debts');
      let userRewardsInfo = {};
      if (!isIncrease) {
        // update for making an order
        if (isOrder && userShare.gte(numOrders)) {
          pending = userShare.times(accRewardPerShare).minus(rewardDebt);
          // decrease before reward debt calc
          userShare = userShare.minus(numOrders);
        }
        // update for making a sale
        if (isSale && salesShare.gte(feesInEth)) {
          salePending = salesShare.times(accSaleRewardPerShare).minus(saleRewardDebt);
          // decrease before reward debt calc
          salesShare = salesShare.minus(feesInEth);
        }
        // update for making a purchase
        if (isPurchase && purchasesShare.gte(feesInEth)) {
          purchasePending = purchasesShare.times(accPurchaseRewardPerShare).minus(purchaseRewardDebt);
          // decrease before reward debt calc
          purchasesShare = purchasesShare.minus(feesInEth);
        }
      } else {
        if (isOrder && userShare.gt(0)) {
          pending = userShare.times(accRewardPerShare).minus(rewardDebt);
        }
        if (isSale && salesShare.gt(0)) {
          salePending = salesShare.times(accSaleRewardPerShare).minus(saleRewardDebt);
        }
        if (isPurchase && purchasesShare.gt(0)) {
          purchasePending = purchasesShare.times(accPurchaseRewardPerShare).minus(purchaseRewardDebt);
        }
        // increase before reward debt calc
        if (isOrder) {
          userShare = userShare.plus(numOrders);
        }
        if (isSale) {
          salesShare = salesShare.plus(feesInEth);
        }
        if (isPurchase) {
          purchasesShare = purchasesShare.plus(feesInEth);
        }
      }

      if (isOrder) {
        userRewardsInfo.share = userShare.toString();
        userRewardsInfo.rewardDebt = userShare.times(accRewardPerShare).toString();
        userRewardsInfo.pending = pending.plus(userInfo.rewardsInfo.pending).toString();
      }
      if (isSale) {
        userRewardsInfo.salesShare = salesShare.toString();
        userRewardsInfo.saleRewardDebt = salesShare.times(accSaleRewardPerShare).toString();
        userRewardsInfo.salePending = salePending.plus(userInfo.rewardsInfo.salePending).toString();
      }
      if (isPurchase) {
        userRewardsInfo.purchasesShare = purchasesShare.toString();
        userRewardsInfo.purchaseRewardDebt = purchasesShare.times(accPurchaseRewardPerShare).toString();
        userRewardsInfo.purchasePending = purchasePending.plus(userInfo.rewardsInfo.purchasePending).toString();
      }

      if (isOrder && hasBonus) {
        if (!isIncrease) {
          if (userBonusShare.gte(numOrders)) {
            bonusPending = userBonusShare.times(accBonusRewardPerShare).minus(bonusRewardDebt);
            // decrease userShare before rewardDebt calc
            userBonusShare = userBonusShare.minus(numOrders);
          }
        } else {
          if (userBonusShare.gt(0)) {
            bonusPending = userBonusShare.times(accBonusRewardPerShare).minus(bonusRewardDebt);
          }
          // add current value before reward debt calc
          userBonusShare = userBonusShare.plus(numOrders);
        }
        userRewardsInfo.userBonusShare = userBonusShare.toString();
        userRewardsInfo.bonusRewardDebt = userBonusShare.times(accBonusRewardPerShare).toString();
        userRewardsInfo.bonusPending = bonusPending.plus(userInfo.rewardsInfo.bonusPending).toString();
      }

      // store updated user rewards
      utils.trace('Updated user rewards: ' + utils.jsonString(userRewardsInfo));
      if (userRewardsInfo) {
        utils.log('Storing updated user rewards');
        userRewardsInfo = { ...userInfo.rewardsInfo, ...userRewardsInfo };
        const updateData = {
          rewardsInfo: userRewardsInfo,
          updatedAt: Date.now()
        };
        utils.trace('Storing updated user rewards:', utils.jsonString(updateData));
        await client.query(insertQuery, [user, updateData]);
      } else {
        utils.log('Not updated user rewards as there are no updates');
      }

      // update global rewards info
      utils.log('Updating global rewards');
      const delta = isIncrease ? numOrders : -1 * numOrders;

      if (isOrder) {
        updatedGlobalRewards.totalShare = totalShare.plus(delta).toString();
      }
      if (isOrder && hasBonus) {
        updatedGlobalRewards.totalBonusShare = totalBonusShare.plus(delta).toString();
      }
      if (actionType === 'purchase' || actionType === 'sale') {
        updatedGlobalRewards.totalFeesShare = totalFeesShare.plus(feesInEth).toString();
      }
      updatedGlobalRewards.totalRewardPaid = pending.plus(globalInfo.rewardsInfo.totalRewardPaid).toString();
      updatedGlobalRewards.totalBonusRewardPaid = bonusPending
        .plus(globalInfo.rewardsInfo.totalBonusRewardPaid)
        .toString();
      updatedGlobalRewards.totalSaleRewardPaid = salePending
        .plus(globalInfo.rewardsInfo.totalSaleRewardPaid)
        .toString();
      updatedGlobalRewards.totalPurchaseRewardPaid = purchasePending
        .plus(globalInfo.rewardsInfo.totalPurchaseRewardPaid)
        .toString();

      utils.log('Updating global stats');
      if (actionType === 'offer') {
        updatedGlobalInfo.totalOffers = bn(globalInfo.totalOffers).plus(delta).toString();
        if (hasBonus) {
          updatedGlobalInfo.totalBonusOffers = bn(globalInfo.totalBonusOffers).plus(delta).toString();
        }
      }
      if (actionType === 'list') {
        updatedGlobalInfo.totalListings = bn(globalInfo.totalListings).plus(delta).toString();
        if (hasBonus) {
          updatedGlobalInfo.totalBonusListings = bn(globalInfo.totalBonusListings).plus(delta).toString();
        }
      }
      if (actionType === 'purchase' || actionType === 'sale') {
        updatedGlobalInfo.totalFees = bn(globalInfo.totalFees).plus(feesInEth).toString();
        updatedGlobalInfo.totalVolume = bn(globalInfo.totalVolume).plus(salePriceInEth).toString();
        updatedGlobalInfo.totalSales = bn(globalInfo.totalSales).plus(numOrders).toString();
      }

      updatedGlobalRewards = { ...globalInfo.rewardsInfo, ...updatedGlobalRewards };
      updatedGlobalInfo = { ...globalInfo, ...updatedGlobalInfo };
      const updateData = {
        ...updatedGlobalInfo,
        rewardsInfo: updatedGlobalRewards,
        updatedAt: Date.now()
      };
      utils.trace('Storing global info:', utils.jsonString(updateData));
      await client.query(insertQuery, [globalInfoId, updateData]);

      // commit txn
      await client.query('COMMIT');
    } catch (err) {
      utils.error('Failed updating global rewards info in pg');
      utils.error(err);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  } catch (err) {
    utils.error('Failed updating user and global rewards info in pg');
    utils.error(err);
  }
}

async function getCurrentBlock() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);
  const currentBlock = await provider.getBlockNumber();
  utils.log('Current eth block: ' + currentBlock);
  return bn(currentBlock);
}

async function getReward(user) {
  utils.log('Getting reward for user', user);

  let globalInfo = {};
  let userInfo = {};

  const client = await pool.connect();
  try {
    const table = process.env.PG_REWARDS_TABLE;
    const globalInfoId = 'globalInfo';
    const selectQuery = 'SELECT data FROM ' + table + ' WHERE id = $1';
    const res = await client.query(selectQuery, [globalInfoId]);
    if (res.rowCount === 1) {
      globalInfo = res.rows[0].data;
    }

    const result = await client.query(selectQuery, [user]);
    if (result.rowCount === 1) {
      userInfo = result.rows[0].data;
    }
  } catch (err) {
    utils.error('Error getting reward for user', user);
    utils.error(err);
    return;
  } finally {
    client.release();
  }

  globalInfo = { ...getEmptyGlobalInfo(), ...globalInfo };
  globalInfo.rewardsInfo = {
    ...getEmptyGlobalInfo().rewardsInfo,
    ...globalInfo.rewardsInfo
  };

  userInfo = { ...getEmptyUserInfo(), ...userInfo };
  userInfo.rewardsInfo = {
    ...getEmptyUserInfo().rewardsInfo,
    ...userInfo.rewardsInfo
  };

  const userStatsRef = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();

  let userStats = userStatsRef.data();
  userStats = { ...getEmptyUserInfo(), ...userStats };

  const currentBlock = await getCurrentBlock();

  const totalOrders = bn(globalInfo.totalListings).plus(globalInfo.totalOffers);
  const totalBonusOrders = bn(globalInfo.totalBonusListings).plus(globalInfo.totalBonusOffers);
  const totalListings = bn(globalInfo.totalListings);
  const totalBonusListings = bn(globalInfo.totalBonusListings);
  const totalOffers = bn(globalInfo.totalOffers);
  const totalBonusOffers = bn(globalInfo.totalBonusOffers);
  const totalFees = bn(globalInfo.totalFees);
  const totalVolume = bn(globalInfo.totalVolume);
  const totalSales = bn(globalInfo.totalSales);

  const totalRewardPaid = bn(globalInfo.rewardsInfo.totalRewardPaid)
    .plus(globalInfo.rewardsInfo.totalBonusRewardPaid)
    .plus(globalInfo.rewardsInfo.totalSaleRewardPaid)
    .plus(globalInfo.rewardsInfo.totalPurchaseRewardPaid);

  const penaltyActivated = globalInfo.rewardsInfo.penaltyActivated;
  const penaltyRatio = bn(globalInfo.rewardsInfo.penaltyRatio);
  const rewardPerBlock = bn(globalInfo.rewardsInfo.rewardPerBlock);
  const bonusRewardPerBlock = bn(globalInfo.rewardsInfo.bonusRewardPerBlock);
  const saleRewardPerBlock = bn(globalInfo.rewardsInfo.saleRewardPerBlock);
  const purchaseRewardPerBlock = bn(globalInfo.rewardsInfo.purchaseRewardPerBlock);

  const lastRewardBlock = bn(globalInfo.rewardsInfo.lastRewardBlock);
  let _accRewardPerShare = bn(globalInfo.rewardsInfo.accRewardPerShare);
  let _accBonusRewardPerShare = bn(globalInfo.rewardsInfo.accBonusRewardPerShare);
  let _accSaleRewardPerShare = bn(globalInfo.rewardsInfo.accSaleRewardPerShare);
  let _accPurchaseRewardPerShare = bn(globalInfo.rewardsInfo.accPurchaseRewardPerShare);

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

  const share = bn(userInfo.rewardsInfo.share);
  const bonusShare = bn(userInfo.rewardsInfo.bonusShare);
  const salesShare = bn(userInfo.rewardsInfo.salesShare);
  const purchasesShare = bn(userInfo.rewardsInfo.purchasesShare);

  const rewardDebt = bn(userInfo.rewardsInfo.rewardDebt);
  const bonusRewardDebt = bn(userInfo.rewardsInfo.bonusRewardDebt);
  const saleRewardDebt = bn(userInfo.rewardsInfo.saleRewardDebt);
  const purchaseRewardDebt = bn(userInfo.rewardsInfo.purchaseRewardDebt);

  const pending = bn(userInfo.rewardsInfo.pending);
  const bonusPending = bn(userInfo.rewardsInfo.bonusPending);
  const salePending = bn(userInfo.rewardsInfo.salePending);
  const purchasePending = bn(userInfo.rewardsInfo.purchasePending);

  const multiplier = currentBlock.minus(lastRewardBlock);
  if (currentBlock.gt(lastRewardBlock) && !totalOrders.eq(0)) {
    const reward = multiplier.times(rewardPerBlock);
    _accRewardPerShare = _accRewardPerShare.plus(reward.div(totalOrders));
  }
  if (currentBlock.gt(lastRewardBlock) && !totalBonusOrders.eq(0)) {
    const bonusReward = multiplier.times(bonusRewardPerBlock);
    _accBonusRewardPerShare = _accBonusRewardPerShare.plus(bonusReward.div(totalBonusOrders));
  }
  if (currentBlock.gt(lastRewardBlock) && !totalFees.eq(0)) {
    const saleReward = multiplier.times(saleRewardPerBlock);
    const purchaseReward = multiplier.times(purchaseRewardPerBlock);
    _accSaleRewardPerShare = _accSaleRewardPerShare.plus(saleReward.div(totalFees));
    _accPurchaseRewardPerShare = _accPurchaseRewardPerShare.plus(purchaseReward.div(totalFees));
  }

  const reward = share.times(_accRewardPerShare).minus(rewardDebt);
  const bonusReward = bonusShare.times(_accBonusRewardPerShare).minus(bonusRewardDebt);
  const saleReward = salesShare.times(_accSaleRewardPerShare).minus(saleRewardDebt);
  const purchaseReward = purchasesShare.times(_accPurchaseRewardPerShare).minus(purchaseRewardDebt);

  const grossReward = reward
    .plus(bonusReward)
    .plus(saleReward)
    .plus(purchaseReward)
    .plus(pending)
    .plus(bonusPending)
    .plus(salePending)
    .plus(purchasePending);

  const grossRewardNumeric = toFixed5(grossReward);

  const resp = {
    currentBlock: currentBlock.toString(),
    totalListings: totalListings.toString(),
    totalBonusListings: totalBonusListings.toString(),
    totalOffers: totalOffers.toString(),
    totalBonusOffers: totalBonusOffers.toString(),
    totalFees: totalFees.toString(),
    totalVolume: totalVolume.toString(),
    totalSales: totalSales.toString(),
    reward: reward.toString(),
    bonusReward: bonusReward.toString(),
    saleReward: saleReward.toString(),
    purchaseReward: purchaseReward.toString(),
    grossReward: grossReward.toString(),
    grossRewardNumeric,
    penaltyActivated,
    penaltyRatio: penaltyRatio.toString(),
    rewardPerBlock: rewardPerBlock.toString(),
    bonusRewardPerBlock: bonusRewardPerBlock.toString(),
    saleRewardPerBlock: saleRewardPerBlock.toString(),
    purchaseRewardPerBlock: purchaseRewardPerBlock.toString(),
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
    totalRewardPaid
  };

  let netReward = grossReward;
  let penalty = bn(0);
  if (penaltyActivated && !netReward.eq(0)) {
    let numTotalOrders = share.plus(bonusShare);
    const numTotalFulfills = salesShare.plus(purchasesShare);
    // special case where user only made purchases without placing any orders;
    // also handles the case where numTotalFulfills = 0 to avoid div by 0
    // this code should never be executed after the netReward > 0 check above
    // also takes care of ratio > 1 case
    // but im paranoid
    numTotalOrders = numTotalOrders.eq(0) ? (numTotalFulfills.eq(0) ? 1 : numTotalFulfills) : numTotalOrders;
    const salesRatio = numTotalFulfills.div(numTotalOrders);
    penalty = penaltyRatio.minus(salesRatio).times(netReward);
    // the edge case where all orders are fulfilled
    if (penalty.lt(0)) {
      penalty = bn(0);
    }
    netReward = netReward.minus(penalty);
  }
  resp.penalty = penalty.toString();
  resp.netReward = netReward.toString();
  resp.netRewardNumeric = toFixed5(netReward);

  // write net reward to firestore async for leaderboard purpose
  // will fail if user doesn't exist
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .update({
      'rewardsInfo.netReward': netReward.toString(),
      'rewardsInfo.netRewardNumeric': toFixed5(netReward),
      'rewardsInfo.grossReward': grossReward.toString(),
      'rewardsInfo.grossRewardNumeric': grossRewardNumeric,
      'rewardsInfo.rewardCalculatedAt': Date.now()
    })
    .then(() => {
      // nothing to do
    })
    .catch((err) => {
      utils.error('Error updating net reward for user ' + user);
      utils.error(err);
    });

  return resp;
}

// ==================================================== Email ==============================================================

const nodemailer = require('nodemailer');
const mailCreds = require('./creds/nftc-dev-nodemailer-creds.json');

const senderEmailAddress = 'hi@nftcompany.com';
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
  const user = req.params.user.trim().toLowerCase();

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

app.post('/u/:user/setEmail', async (req, res) => {
  const user = req.params.user.trim().toLowerCase();
  const email = req.body.email.trim().toLowerCase();
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
      const subject = 'Verify your email for NFT Company';
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
  const user = req.query.user.trim().toLowerCase();
  // @ts-ignore
  const email = req.query.email.trim().toLowerCase();
  // @ts-ignore
  const guid = req.query.guid.trim().toLowerCase();
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

app.post('/u/:user/subscribeEmail', async (req, res) => {
  const user = req.params.user.trim().toLowerCase();
  const data = req.body;
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
    .then((data) => {
      res.sendStatus(200);
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
    subject = 'You received a ' + price + ' ETH offer at NFT Company';
    link += '/offers-received';
  } else if (type === 'offerAccepted') {
    subject = 'Your offer of ' + price + ' ETH has been accepted at NFT Company';
    link += '/purchases';
  } else if (type === 'itemPurchased') {
    subject = 'Your item has been purchased for ' + price + ' ETH at NFT Company';
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

// ============================================================ Misc ======================================================

async function isTokenVerified(address) {
  const doc = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.VERIFIED_TOKENS_COLL)
    .doc(address)
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
  return +num.toString().match(/^-?\d+(?:\.\d{0,5})?/)[0];
}

function bn(num) {
  // @ts-ignore
  const bigNum = BigNumber(num);
  // console.log(num + '   ====== bigNUm ' + bigNum);
  // console.log(__line);
  return bigNum;
}
