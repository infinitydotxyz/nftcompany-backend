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

const nftDataSources = {
  0: 'nftc',
  1: 'opensea',
  2: 'unmarshal',
  3: 'alchemy'
};
const DEFAULT_ITEMS_PER_PAGE = 50;
const DEFAULT_MAX_ETH = 5000; // for listings

// init server
init();

// ============================================== Global data handling ======================================================
let globalInfo;
let localInfo;
let origLocalInfo;

async function init() {
  // get global info doc
  try {
    const globalInfoDoc = await db.collection(fstrCnstnts.ROOT_COLL).doc(fstrCnstnts.INFO_DOC).get();
    globalInfo = { ...getEmptyGlobalInfo(), ...globalInfoDoc.data() };
    globalInfo.rewardsInfo = {
      ...getEmptyGlobalInfo().rewardsInfo,
      ...globalInfoDoc.data().rewardsInfo
    };
    // set local info
    localInfo = JSON.parse(JSON.stringify(globalInfo));
    origLocalInfo = JSON.parse(JSON.stringify(localInfo));
  } catch (err) {
    utils.error('Encountered error while getting global info. Exiting process');
    utils.error(err);
    process.exit();
  }

  // Start server and listen to the App Engine-specified port, or 9090 otherwise
  const PORT = process.env.PORT || 9090;
  app.listen(PORT, () => {
    utils.log(`Server listening on port ${PORT}...`);
  });

  // listen to global info changes and update
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .onSnapshot(
      (snapshot) => {
        globalInfo = snapshot.data();
      },
      (err) => {
        utils.error('Error in listening to global info doc changes');
        utils.error(err);
      }
    );

  // write localdata to firestore every interval
  setInterval(async () => {
    const globalDocRef = db.collection(fstrCnstnts.ROOT_COLL).doc(fstrCnstnts.INFO_DOC);
    try {
      globalInfo = await db.runTransaction(async (txn) => {
        const globalDoc = await txn.get(globalDocRef);
        utils.trace('Newly fetched firestore global info: ' + utils.jsonString(globalDoc.data()));
        // reconcile globalinfo
        const newInfo = reconcileGlobalInfo(globalDoc.data());
        await txn.update(globalDocRef, newInfo);
        return newInfo;
      });
      origLocalInfo = JSON.parse(JSON.stringify(globalInfo));
      utils.trace('Reconciled global info: ' + utils.jsonString(globalInfo));
    } catch (err) {
      utils.error('Failed updating global info in firestore', err);
      utils.error(err);
    }
  }, 1000 * 60); // every 60 seconds
}

function reconcileGlobalInfo(globalData) {
  const newInfo = { ...getEmptyGlobalInfo(), ...globalData };
  newInfo.rewardsInfo = {
    ...getEmptyGlobalInfo().rewardsInfo,
    ...globalData.rewardsInfo
  };

  const localInfoDelta = getLocalInfoDelta();
  utils.trace('Local info delta: ' + utils.jsonString(localInfoDelta));

  newInfo.updatedAt = Date.now();
  newInfo.totalSales = bn(newInfo.totalSales).plus(localInfoDelta.totalSales).toString();
  newInfo.totalFees = bn(newInfo.totalFees).plus(localInfoDelta.totalFees).toString();
  newInfo.totalVolume = bn(newInfo.totalVolume).plus(localInfoDelta.totalVolume).toString();
  newInfo.totalListings = bn(newInfo.totalListings).plus(localInfoDelta.totalListings).toString();
  newInfo.totalBonusListings = bn(newInfo.totalBonusListings).plus(localInfoDelta.totalBonusListings).toString();
  newInfo.totalOffers = bn(newInfo.totalOffers).plus(localInfoDelta.totalOffers).toString();
  newInfo.totalBonusOffers = bn(newInfo.totalBonusOffers).plus(localInfoDelta.totalBonusOffers).toString();

  newInfo.rewardsInfo.accRewardPerShare = bn(newInfo.rewardsInfo.accRewardPerShare)
    .plus(localInfoDelta.rewardsInfo.accRewardPerShare)
    .toString();
  newInfo.rewardsInfo.accBonusRewardPerShare = bn(newInfo.rewardsInfo.accBonusRewardPerShare)
    .plus(localInfoDelta.rewardsInfo.accBonusRewardPerShare)
    .toString();
  newInfo.rewardsInfo.accSaleRewardPerShare = bn(newInfo.rewardsInfo.accSaleRewardPerShare)
    .plus(localInfoDelta.rewardsInfo.accSaleRewardPerShare)
    .toString();
  newInfo.rewardsInfo.accPurchaseRewardPerShare = bn(newInfo.rewardsInfo.accPurchaseRewardPerShare)
    .plus(localInfoDelta.rewardsInfo.accPurchaseRewardPerShare)
    .toString();
  newInfo.rewardsInfo.totalRewardPaid = bn(newInfo.rewardsInfo.totalRewardPaid)
    .plus(localInfoDelta.rewardsInfo.totalRewardPaid)
    .toString();
  newInfo.rewardsInfo.totalBonusRewardPaid = bn(newInfo.rewardsInfo.totalBonusRewardPaid)
    .plus(localInfoDelta.rewardsInfo.totalBonusRewardPaid)
    .toString();
  newInfo.rewardsInfo.totalSaleRewardPaid = bn(newInfo.rewardsInfo.totalSaleRewardPaid)
    .plus(localInfoDelta.rewardsInfo.totalSaleRewardPaid)
    .toString();
  newInfo.rewardsInfo.totalPurchaseRewardPaid = bn(newInfo.rewardsInfo.totalPurchaseRewardPaid)
    .plus(localInfoDelta.rewardsInfo.totalPurchaseRewardPaid)
    .toString();

  if (bn(newInfo.rewardsInfo.lastRewardBlock).lt(localInfo.rewardsInfo.lastRewardBlock)) {
    newInfo.rewardsInfo.lastRewardBlock = bn(localInfo.rewardsInfo.lastRewardBlock).toString();
  }
  return newInfo;
}

function getLocalInfoDelta() {
  const localInfoDelta = getEmptyGlobalInfo();
  localInfoDelta.rewardsInfo = getEmptyGlobalInfo().rewardsInfo;

  localInfoDelta.totalSales = bn(localInfo.totalSales).minus(origLocalInfo.totalSales);
  localInfoDelta.totalFees = bn(localInfo.totalFees).minus(origLocalInfo.totalFees);
  localInfoDelta.totalVolume = bn(localInfo.totalVolume).minus(origLocalInfo.totalVolume);
  localInfoDelta.totalListings = bn(localInfo.totalListings).minus(origLocalInfo.totalListings);
  localInfoDelta.totalBonusListings = bn(localInfo.totalBonusListings).minus(origLocalInfo.totalBonusListings);
  localInfoDelta.totalOffers = bn(localInfo.totalOffers).minus(origLocalInfo.totalOffers);
  localInfoDelta.totalBonusOffers = bn(localInfo.totalBonusOffers).minus(origLocalInfo.totalBonusOffers);

  localInfoDelta.rewardsInfo.accRewardPerShare = bn(localInfo.rewardsInfo.accRewardPerShare).minus(
    origLocalInfo.rewardsInfo.accRewardPerShare
  );

  localInfoDelta.rewardsInfo.accBonusRewardPerShare = bn(localInfo.rewardsInfo.accBonusRewardPerShare).minus(
    origLocalInfo.rewardsInfo.accBonusRewardPerShare
  );

  localInfoDelta.rewardsInfo.accSaleRewardPerShare = bn(localInfo.rewardsInfo.accSaleRewardPerShare).minus(
    origLocalInfo.rewardsInfo.accSaleRewardPerShare
  );

  localInfoDelta.rewardsInfo.accPurchaseRewardPerShare = bn(localInfo.rewardsInfo.accPurchaseRewardPerShare).minus(
    origLocalInfo.rewardsInfo.accPurchaseRewardPerShare
  );

  localInfoDelta.rewardsInfo.totalRewardPaid = bn(localInfo.rewardsInfo.totalRewardPaid).minus(
    origLocalInfo.rewardsInfo.totalRewardPaid
  );

  localInfoDelta.rewardsInfo.totalBonusRewardPaid = bn(localInfo.rewardsInfo.totalBonusRewardPaid).minus(
    origLocalInfo.rewardsInfo.totalBonusRewardPaid
  );

  localInfoDelta.rewardsInfo.totalSaleRewardPaid = bn(localInfo.rewardsInfo.totalSaleRewardPaid).minus(
    origLocalInfo.rewardsInfo.totalSaleRewardPaid
  );

  localInfoDelta.rewardsInfo.totalPurchaseRewardPaid = bn(localInfo.rewardsInfo.totalPurchaseRewardPaid).minus(
    origLocalInfo.rewardsInfo.totalPurchaseRewardPaid
  );

  return localInfoDelta;
}

// =========================================== Server ===========================================================

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
    let resp = {
      verified,
      bonusReward
    };
    resp = utils.jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=3600',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
    });
    res.send(resp);
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// fetch listings (for Explore page)
app.get('/listings', async (req, res) => {
  const priceMin = req.query.priceMin || '0'; // add a default min of 0 eth
  const priceMax = +req.query.priceMax || DEFAULT_MAX_ETH; // add a default max of 5000 eth
  const sortByPrice = `${req.query.sortByPrice || 'asc'}`.toLowerCase(); // ascending default
  const { limit, startAfterPrice, startAfter, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterPrice', 'startAfter'],
    [`${DEFAULT_ITEMS_PER_PAGE}`, sortByPrice === 'asc' ? '0' : `${priceMax}`, `${Date.now()}`]
  );
  if (error) {
    return;
  }
  // console.log('/listings params:', price, sortByPrice, limit, startAfter, startAfterPrice)
  db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where('metadata.basePriceInEth', '>=', +priceMin)
    .where('metadata.basePriceInEth', '<=', +priceMax)
    .orderBy('metadata.basePriceInEth', sortByPrice) // asc (default) or desc
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterPrice, startAfter)
    .limit(limit)
    .get()
    .then((data) => {
      const resp = getOrdersResponse(data);
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get listings');
      utils.error(err);
      res.sendStatus(500);
    });
});

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
  const { limit, startAfter, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfter'],
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
    .startAfter(startAfter)
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
  const { limit, startAfter, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfter'],
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
    .startAfter(startAfter)
    .limit(limit)
    .get()
    .then((data) => {
      const purchases = [];
      for (const doc of data.docs) {
        const purchase = doc.data();
        purchase.id = doc.id;
        purchases.push(purchase);
      }
      let resp = {
        count: purchases.length,
        purchases: purchases
      };
      resp = utils.jsonString(resp);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=30',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
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
  const { limit, startAfter, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfter'],
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
    .startAfter(startAfter)
    .limit(limit)
    .get()
    .then((data) => {
      const sales = [];
      for (const doc of data.docs) {
        const sale = doc.data();
        sale.id = doc.id;
        sales.push(sale);
      }
      let resp = {
        count: sales.length,
        sales: sales
      };
      resp = utils.jsonString(resp);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=30',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
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
  const { limit, startAfter, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfter'],
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
    .startAfter(startAfter)
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
  const { limit, startAfter, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfter'],
    ['50', `${Date.now()}`]
  );
  if (error) {
    return;
  }
  db.collectionGroup(fstrCnstnts.OFFERS_COLL)
    .where('metadata.asset.owner', '==', user)
    .orderBy('metadata.basePriceInEth', sortByPrice)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfter)
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
// todo: adi who using it
app.get('/wyvern/v1/orders', async (req, res) => {
  let docId;

  if (req.query.id) {
    docId = req.query.id.trim(); // preserve case
  }

  if (docId && docId.length > 0) {
    return getOrdersWithDocId(req, res);
  }

  return getOrdersWithTokenId(req, res);
});

async function getOrders(maker, tokenAddress, tokenId, side) {
  utils.log('Fetching order for', maker, tokenAddress, tokenId, side);
  const results = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.LISTINGS_COLL)
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

const getOrdersWithTokenId = async (req, res) => {
  if (!req.query.maker || !req.query.tokenAddress) {
    res.sendStatus(400);
  }

  const maker = req.query.maker.trim().toLowerCase();
  const tokenAddress = req.query.tokenAddress.trim().toLowerCase();
  const tokenId = req.query.tokenId;
  const side = req.query.side;

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

const getOrdersWithDocId = async (req, res) => {
  if (!req.query.maker || !req.query.id) {
    res.sendStatus(400);
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
    }
  } catch (err) {
    utils.error('Error fetching order: ' + docId + ' for user ' + maker + ' from collection ' + collection);
    utils.error(err);
    res.sendStatus(500);
  }
};

// fetch user reward
app.get('/u/:user/reward', async (req, res) => {
  const user = req.params.user.trim().toLowerCase();
  try {
    let resp = await getReward(user);
    resp = utils.jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=300',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
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
    .orderBy('rewardsInfo.grossRewardNumeric', 'desc')
    .limit(10)
    .get()
    .then((data) => {
      const results = [];
      for (const doc of data.docs) {
        results.push(doc.data());
      }
      let resp = {
        count: results.length,
        results: results
      };
      resp = utils.jsonString(resp);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=600',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
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
        let resp = data.docs.map((doc) => {
          return {
            title: doc.data().metadata.asset.title,
            id: doc.data().metadata.asset.id,
            address: doc.data().metadata.asset.address
          };
        });
        resp = utils.jsonString(resp);
        res.set({
          'Cache-Control': 'must-revalidate, max-age=600',
          'Content-Length': Buffer.byteLength(resp, 'utf8')
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

app.get('/listingById', async (req, res) => {
  const id = req.query.id;
  const address = req.query.address;
  db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where('metadata.asset.id', '==', id)
    .where('metadata.asset.address', '==', address)
    .get()
    .then((data) => {
      const resp = utils.jsonString(
        data.docs.map((doc) => {
          return doc.data();
        })[0]
      );
      res.set({
        'Cache-Control': 'must-revalidate, max-age=600',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get listing by id', err);
      res.sendStatus(500);
    });
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
        resp = utils.jsonString(resp);
        res.set({
          'Cache-Control': 'must-revalidate, max-age=600',
          'Content-Length': Buffer.byteLength(resp, 'utf8')
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

app.get('/listingsByCollectionName', async (req, res) => {
  const collectionName = req.query.collectionName;

  const priceMin = req.query.priceMin || '0'; // add a default min of 0 eth
  const priceMax = req.query.priceMax || '5000'; // add a default max of 5000 eth
  const sortByPrice = req.query.sortByPrice || 'desc'; // descending default
  db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where('metadata.basePriceInEth', '>=', +priceMin)
    .where('metadata.basePriceInEth', '<=', +priceMax)
    .where('metadata.asset.collectionName', '==', collectionName)
    .orderBy('metadata.basePriceInEth', sortByPrice)
    .get()
    .then((data) => {
      const resp = utils.jsonString(
        data.docs.map((doc) => {
          return doc.data();
        })
      );
      res.set({
        'Cache-Control': 'must-revalidate, max-age=600',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
      res.send(resp);
    })
    .catch((err) => {
      utils.error('Failed to get listings by collection name', err);
      res.sendStatus(500);
    });
});

app.get('/u/:user/wyvern/v1/txns', async (req, res) => {
  const user = req.params.user.trim().toLowerCase();
  const { limit, startAfter, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfter'],
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
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .startAfter(startAfter)
      .limit(limit)
      .get();

    const txns = [];
    for (const doc of snapshot.docs) {
      const txn = doc.data();
      txn.id = doc.id;
      txns.push(txn);
      // check status
      waitForTxn(user, txn);
    }
    let resp = {
      count: txns.length,
      listings: txns
    };
    resp = utils.jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
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
  try {
    // check if token has bonus if payload instructs so
    let hasBonus = payload.metadata.hasBonusReward;
    if (payload.metadata.checkBonusReward) {
      hasBonus = await hasBonusReward(tokenAddress);
    }
    payload.metadata.hasBonusReward = hasBonus;

    // update rewards
    const userInfo = await getUserInfoAndUpdatedUserRewards(maker, hasBonus, numOrders, 0, true, 'order');

    if (userInfo.rewardsInfo) {
      // update user rewards data
      storeUpdatedUserRewards(batch, maker, userInfo.rewardsInfo);
    } else {
      utils.log('Not updating rewards data as there are no updates');
    }

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
    utils.log('Posting an order');
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

    payload.status = 'pending';
    payload.txnType = 'original'; // possible values are original, cancellation and replacement
    payload.createdAt = Date.now();

    utils.log('Writing pending txn: ' + txnHash + ' to firestore');
    // save to firestore
    db.collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.TXNS_COLL)
      .doc(txnHash)
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

async function waitForTxn(user, payload) {
  user = user.trim().toLowerCase();
  const actionType = payload.actionType.trim().toLowerCase();
  const origTxnHash = payload.txnHash.trim();
  utils.log('Waiting for txn: ' + origTxnHash);

  const batch = db.batch();
  const userPendingTxnCollRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.TXNS_COLL);

  const origTxnDocRef = userPendingTxnCollRef.doc(origTxnHash);
  const confirms = 1;

  try {
    const receipt = await ethersProvider.waitForTransaction(origTxnHash, confirms);
    // orig txn confirmed
    utils.log('Txn: ' + origTxnHash + ' confirmed after ' + confirms + ' block(s)');
    const txnData = JSON.parse(utils.jsonString(receipt));
    batch.set(origTxnDocRef, { status: 'confirmed', txnData }, { merge: true });
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
      const newTxnDocRef = userPendingTxnCollRef.doc(replacementTxnHash);
      payload.createdAt = Date.now();
      const newPayload = {
        origTxnHash,
        ...payload
      };
      batch.set(newTxnDocRef, newPayload);
    }
  }

  // commit batch
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
    utils.log('Fulfilling order');
    const taker = user.trim().toLowerCase();
    const salePriceInEth = +payload.salePriceInEth;
    const side = +payload.side;
    const docId = payload.orderId.trim(); // preserve case
    const feesInEth = +payload.feesInEth;
    const txnHash = payload.txnHash;
    const maker = payload.maker.trim().toLowerCase();

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
        utils.log('No order ' + docId + ' to fulfill');
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
        utils.log('No order ' + docId + ' to fulfill');
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

    // update total sales
    incrementLocalStats({ totalSales: numOrders });

    // update total fees
    incrementLocalStats({ totalFees: feesInEth });

    // update total volume
    incrementLocalStats({ totalVolume: salePriceInEth });
  } catch (err) {
    utils.error('Error in fufilling order');
    utils.error(err);
  }
}

async function saveBoughtOrder(user, order, batch, numOrders) {
  utils.log('Writing purchase to firestore');
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
  const purchaseFees = fees.div(5);
  const salePriceInEth = bn(order.metadata.salePriceInEth);

  // update rewards first; before stats
  const userInfo = await getUserInfoAndUpdatedUserRewards(user, false, numOrders, purchaseFees, true, 'purchase');

  if (userInfo.rewardsInfo) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, userInfo.rewardsInfo);
  } else {
    utils.log('Not updating rewards data as there are no updates');
  }

  // update user txn stats
  const purchasesTotal = bn(userInfo.purchasesTotal).plus(salePriceInEth).toString();
  const purchasesFeesTotal = bn(userInfo.purchasesFeesTotal).plus(purchaseFees).toString();
  const purchasesTotalNumeric = toFixed5(purchasesTotal);
  const purchasesFeesTotalNumeric = toFixed5(purchasesFeesTotal);

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
  utils.log('Writing sale to firestore');
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
  const userInfo = await getUserInfoAndUpdatedUserRewards(user, false, numOrders, feesInEth, true, 'sale');

  if (userInfo.rewardsInfo) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, userInfo.rewardsInfo);
  } else {
    utils.log('Not updating rewards data as there are no updates');
  }

  // update user txn stats
  const salesTotal = bn(userInfo.salesTotal).plus(salePriceInEth).toString();
  const salesFeesTotal = bn(userInfo.salesFeesTotal).plus(feesInEth).toString();
  const salesTotalNumeric = toFixed5(salesTotal);
  const salesFeesTotalNumeric = toFixed5(salesFeesTotal);

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
  utils.log('Writing listing to firestore');
  // check if token is verified if payload instructs so
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
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
    .doc();

  batch.set(listingRef, payload, { merge: true });

  // update num user listings
  updateNumOrders(batch, maker, numOrders, hasBonus, 1);
  // update total listings
  updateNumTotalOrders(numOrders, hasBonus, 1);
}

async function postOffer(maker, payload, batch, numOrders, hasBonus) {
  utils.log('Writing offer to firestore');
  const taker = payload.metadata.asset.owner.trim().toLowerCase();
  payload.metadata.createdAt = Date.now();
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
  // update total offers made
  updateNumTotalOrders(numOrders, hasBonus, 0);

  // send email to taker that an offer is made
  prepareEmail(taker, payload, 'offerMade');
}

function updateNumOrders(batch, user, num, hasBonus, side) {
  utils.log('Updating num orders');
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

function updateNumTotalOrders(num, hasBonus, side) {
  utils.log('Updating num total orders');
  let totalOffers = 0;
  let totalBonusOffers = 0;
  let totalListings = 0;
  let totalBonusListings = 0;

  if (side === 0) {
    totalOffers = num;
    if (hasBonus) {
      totalBonusOffers = num;
    }
  } else if (side === 1) {
    totalListings = num;
    if (hasBonus) {
      totalBonusListings = num;
    }
  }
  // apply to memory
  incrementLocalStats({
    totalOffers,
    totalBonusOffers,
    totalListings,
    totalBonusListings
  });
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
  return resp;
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
    utils.log(url);
    const { data } = await axios.get(url, options);
    return data;
  } catch (err) {
    utils.error('Error occured while fetching assets from opensea');
    utils.error(err);
  }
}

// ============================================= Delete helpers ==========================================================

async function cancelListing(user, batch, docId) {
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

function deleteExpiredOrder(doc) {
  utils.log('Deleting expired order', doc.id);
  const order = doc.data();
  const side = +order.side;
  const batch = db.batch();
  if (side === 1) {
    // listing
    deleteListing(batch, doc.ref);
  } else if (side === 0) {
    // offer
    deleteOffer(batch, doc.ref);
  } else {
    utils.error('Unknown order type', doc.id);
  }
}

async function deleteListingWithId(id, user, batch) {
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

  const userInfo = await getUserInfoAndUpdatedUserRewards(user, hasBonus, numOrders, 0, false, 'order');

  if (userInfo.rewardsInfo) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, userInfo.rewardsInfo);
  } else {
    utils.log('Not updating rewards data as there are no updates');
  }

  // delete listing
  batch.delete(doc.ref);

  // update num user listings
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 1);

  // update total listings
  updateNumTotalOrders(-1 * numOrders, hasBonus, 1);
}

async function deleteOfferMadeWithId(id, user, batch) {
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
  const offer = doc.id;
  utils.log('Deleting offer', offer);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  const userInfo = await getUserInfoAndUpdatedUserRewards(user, hasBonus, numOrders, 0, false, 'order');

  if (userInfo.rewardsInfo) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, userInfo.rewardsInfo);
  } else {
    utils.log('Not updating rewards data as there are no updates');
  }

  // delete offer
  batch.delete(doc.ref);

  // update num user offers
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 0);

  // update total offers
  updateNumTotalOrders(-1 * numOrders, hasBonus, 0);
}

// =============================================== Rewards calc logic ========================================================

function incrementLocalStats({
  totalOffers,
  totalBonusOffers,
  totalListings,
  totalBonusListings,
  totalFees,
  totalVolume,
  totalSales
}) {
  localInfo.totalOffers = bn(localInfo.totalOffers).plus(totalOffers || 0);
  localInfo.totalBonusOffers = bn(localInfo.totalBonusOffers).plus(totalBonusOffers || 0);
  localInfo.totalListings = bn(localInfo.totalListings).plus(totalListings || 0);
  localInfo.totalBonusListings = bn(localInfo.totalBonusListings).plus(totalBonusListings || 0);
  localInfo.totalFees = bn(localInfo.totalFees).plus(totalFees || 0);
  localInfo.totalVolume = bn(localInfo.totalVolume).plus(totalVolume || 0);
  localInfo.totalSales = bn(localInfo.totalSales).plus(totalSales || 0);
}

function storeUpdatedUserRewards(batch, user, data) {
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  batch.set(ref, { rewardsInfo: data, updatedAt: Date.now() }, { merge: true });
}

async function hasBonusReward(address) {
  const doc = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
    .doc(address)
    .get();
  return doc.exists;
}

async function getUserInfoAndUpdatedUserRewards(user, hasBonus, numOrders, fees, isIncrease, actionType) {
  utils.log('Getting updated reward for user', user);

  let userInfo = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  userInfo = { ...getEmptyUserInfo(), ...userInfo.data() };
  userInfo.rewardsInfo = {
    ...getEmptyUserRewardInfo(),
    ...userInfo.rewardsInfo
  };

  const updatedUserRewards = updateRewards(userInfo, hasBonus, numOrders, bn(fees), isIncrease, actionType);
  if (!updatedUserRewards) {
    userInfo.rewardsInfo = null;
  }
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
async function updateRewards(userInfo, hasBonus, numOrders, fees, isIncrease, actionType) {
  utils.log('Updating rewards in increasing mode = ', isIncrease);

  let userShare = bn(userInfo.numListings).plus(userInfo.numOffers);
  let userBonusShare = bn(userInfo.numBonusListings).plus(userInfo.numBonusOffers);
  let salesFeesTotal = bn(userInfo.salesFeesTotal);
  let purchasesFeesTotal = bn(userInfo.purchasesFeesTotal);
  const rewardDebt = bn(userInfo.rewardsInfo.rewardDebt);
  const bonusRewardDebt = bn(userInfo.rewardsInfo.bonusRewardDebt);
  const saleRewardDebt = bn(userInfo.rewardsInfo.saleRewardDebt);
  const purchaseRewardDebt = bn(userInfo.rewardsInfo.purchaseRewardDebt);
  let pending = bn(0);
  let bonusPending = bn(0);
  let salePending = bn(0);
  let purchasePending = bn(0);

  const result = await updateLocalRewards();
  if (!result) {
    utils.log('Not updating rewards');
    return;
  }

  const isOrder = actionType === 'order';
  const isSale = actionType === 'sale';
  const isPurchase = actionType === 'purchase';

  const accRewardPerShare = bn(localInfo.rewardsInfo.accRewardPerShare);
  const accSaleRewardPerShare = bn(localInfo.rewardsInfo.accSaleRewardPerShare);
  const accPurchaseRewardPerShare = bn(localInfo.rewardsInfo.accPurchaseRewardPerShare);
  const accBonusRewardPerShare = bn(localInfo.rewardsInfo.accBonusRewardPerShare);

  if (!isIncrease) {
    // update for making an order
    if (isOrder && userShare.gte(numOrders)) {
      pending = userShare.times(accRewardPerShare).minus(rewardDebt);
      // decrease before reward debt calc
      userShare = userShare.minus(numOrders);
    }
    // update for making a sale
    if (isSale && salesFeesTotal.gte(fees)) {
      salePending = salesFeesTotal.times(accSaleRewardPerShare).minus(saleRewardDebt);
      salesFeesTotal = salesFeesTotal.minus(fees);
    }
    // update for making a purchase
    if (isPurchase && purchasesFeesTotal.gte(fees)) {
      purchasePending = purchasesFeesTotal.times(accPurchaseRewardPerShare).minus(purchaseRewardDebt);
      purchasesFeesTotal = purchasesFeesTotal.minus(fees);
    }
  } else {
    if (isOrder && userShare.gte(0)) {
      pending = userShare.times(accRewardPerShare).minus(rewardDebt);
    }
    if (isSale && salesFeesTotal.gte(0)) {
      salePending = salesFeesTotal.times(accSaleRewardPerShare).minus(saleRewardDebt);
    }
    if (isPurchase && purchasesFeesTotal.gte(0)) {
      purchasePending = purchasesFeesTotal.times(accPurchaseRewardPerShare).minus(purchaseRewardDebt);
    }
    // increase before reward debt calc
    if (isOrder) {
      userShare = userShare.plus(numOrders);
    }
    if (isSale) {
      salesFeesTotal = salesFeesTotal.plus(fees);
    }
    if (isPurchase) {
      purchasesFeesTotal = purchasesFeesTotal.plus(fees);
    }
  }

  if (isOrder) {
    userInfo.rewardsInfo.rewardDebt = userShare.times(accRewardPerShare).toString();
    userInfo.rewardsInfo.pending = pending.toString();
  }
  if (isSale) {
    userInfo.rewardsInfo.saleRewardDebt = salesFeesTotal.times(accSaleRewardPerShare).toString();
    userInfo.rewardsInfo.salePending = salePending.toString();
  }
  if (isPurchase) {
    userInfo.rewardsInfo.purchaseRewardDebt = purchasesFeesTotal.times(accPurchaseRewardPerShare).toString();
    userInfo.rewardsInfo.purchasePending = purchasePending.toString();
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
    userInfo.rewardsInfo.bonusRewardDebt = userBonusShare.times(accBonusRewardPerShare).toString();
    userInfo.rewardsInfo.bonusPending = bonusPending.toString();
  }

  // update local info
  localInfo.rewardsInfo.totalRewardPaid = pending.plus(localInfo.rewardsInfo.totalRewardPaid);
  localInfo.rewardsInfo.totalBonusRewardPaid = bonusPending.plus(localInfo.rewardsInfo.totalBonusRewardPaid);
  localInfo.rewardsInfo.totalSaleRewardPaid = salePending.plus(localInfo.rewardsInfo.totalSaleRewardPaid);
  localInfo.rewardsInfo.totalPurchaseRewardPaid = purchasePending.plus(localInfo.rewardsInfo.totalPurchaseRewardPaid);

  return userInfo.rewardsInfo;
}

// updates lastRewardBlock, accRewardPerShare, accBonusRewardPerShare
async function updateLocalRewards() {
  utils.log('Updating local rewards');
  const currentBlock = await getCurrentBlock();
  const totalOrders = bn(globalInfo.totalListings).plus(globalInfo.totalOffers);
  const totalBonusOrders = bn(globalInfo.totalBonusListings).plus(globalInfo.totalBonusOffers);
  const totalFees = bn(globalInfo.totalFees);
  const rewardPerBlock = bn(globalInfo.rewardsInfo.rewardPerBlock);
  const bonusRewardPerBlock = bn(globalInfo.rewardsInfo.bonusRewardPerBlock);
  const saleRewardPerBlock = bn(globalInfo.rewardsInfo.saleRewardPerBlock);
  const purchaseRewardPerBlock = bn(globalInfo.rewardsInfo.purchaseRewardPerBlock);

  const accRewardPerShare = bn(localInfo.rewardsInfo.accRewardPerShare);
  const accBonusRewardPerShare = bn(localInfo.rewardsInfo.accBonusRewardPerShare);
  const accSaleRewardPerShare = bn(localInfo.rewardsInfo.accSaleRewardPerShare);
  const accPurchaseRewardPerShare = bn(localInfo.rewardsInfo.accPurchaseRewardPerShare);

  const lastRewardBlock = bn(localInfo.rewardsInfo.lastRewardBlock);

  if (currentBlock.lte(lastRewardBlock)) {
    utils.log('Not updating global rewards since current block <= lastRewardBlock');
    return false;
  }
  if (totalOrders.eq(0)) {
    utils.log('Not updating global rewards since total liquidity is 0');
    return false;
  }
  const multiplier = currentBlock.minus(lastRewardBlock);
  const reward = multiplier.times(rewardPerBlock);
  localInfo.rewardsInfo.accRewardPerShare = accRewardPerShare.plus(reward.div(totalOrders));
  if (totalBonusOrders.gte(0)) {
    const bonusReward = multiplier.times(bonusRewardPerBlock);
    localInfo.rewardsInfo.accBonusRewardPerShare = accBonusRewardPerShare.plus(bonusReward.div(totalBonusOrders));
  }
  if (totalFees.gte(0)) {
    const saleReward = multiplier.times(saleRewardPerBlock);
    localInfo.rewardsInfo.accSaleRewardPerShare = accSaleRewardPerShare.plus(saleReward.div(totalFees));
    const purchaseReward = multiplier.times(purchaseRewardPerBlock);
    localInfo.rewardsInfo.accPurchaseRewardPerShare = accPurchaseRewardPerShare.plus(purchaseReward.div(totalFees));
  }

  localInfo.rewardsInfo.lastRewardBlock = currentBlock;

  return true;
}

async function getCurrentBlock() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);
  const currentBlock = await provider.getBlockNumber();
  utils.log('Current eth block: ' + currentBlock);
  return bn(currentBlock);
}

async function getReward(user) {
  utils.log('Getting reward for user', user);

  let userInfo = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  userInfo = { ...getEmptyUserInfo(), ...userInfo.data() };
  userInfo.rewardsInfo = {
    ...getEmptyUserRewardInfo(),
    ...userInfo.rewardsInfo
  };
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

  const penaltyActivated = globalInfo.rewardsInfo.penaltyActivated;
  const penaltyRatio = bn(globalInfo.rewardsInfo.penaltyRatio);
  const rewardPerBlock = bn(globalInfo.rewardsInfo.rewardPerBlock);
  const bonusRewardPerBlock = bn(globalInfo.rewardsInfo.bonusRewardPerBlock);
  const saleRewardPerBlock = bn(globalInfo.rewardsInfo.saleRewardPerBlock);
  const purchaseRewardPerBlock = bn(globalInfo.rewardsInfo.purchaseRewardPerBlock);

  const lastRewardBlock = bn(localInfo.rewardsInfo.lastRewardBlock);
  let _accRewardPerShare = bn(localInfo.rewardsInfo.accRewardPerShare);
  let _accBonusRewardPerShare = bn(localInfo.rewardsInfo.accBonusRewardPerShare);
  let _accSaleRewardPerShare = bn(localInfo.rewardsInfo.accSaleRewardPerShare);
  let _accPurchaseRewardPerShare = bn(localInfo.rewardsInfo.accPurchaseRewardPerShare);

  const numListings = bn(userInfo.numListings);
  const numBonusListings = bn(userInfo.numBonusListings);
  const numOffers = bn(userInfo.numOffers);
  const numBonusOffers = bn(userInfo.numBonusOffers);
  const numPurchases = bn(userInfo.numPurchases);
  const numSales = bn(userInfo.numSales);
  const numOrders = bn(userInfo.numListings).plus(userInfo.numOffers);
  const numBonusOrders = bn(userInfo.numBonusListings).plus(userInfo.numBonusOffers);

  const salesTotal = bn(userInfo.salesFeesTotal);
  const salesFeesTotal = bn(userInfo.salesFeesTotal);
  const salesTotalNumeric = userInfo.salesTotalNumeric;
  const salesFeesTotalNumeric = userInfo.salesFeesTotalNumeric;

  const purchasesTotal = bn(userInfo.purchasesTotal);
  const purchasesFeesTotal = bn(userInfo.purchasesFeesTotal);
  const purchasesTotalNumeric = userInfo.purchasesTotalNumeric;
  const purchasesFeesTotalNumeric = userInfo.purchasesFeesTotalNumeric;

  const rewardDebt = bn(userInfo.rewardsInfo.rewardDebt);
  const bonusRewardDebt = bn(userInfo.rewardsInfo.bonusRewardDebt);
  const saleRewardDebt = bn(userInfo.rewardsInfo.saleRewardDebt);
  const purchaseRewardDebt = bn(userInfo.rewardsInfo.purchaseRewardDebt);
  const pending = bn(userInfo.rewardsInfo.pending);
  const bonusPending = bn(userInfo.rewardsInfo.bonusPending);
  const salePending = bn(userInfo.rewardsInfo.salePending);
  const purchasePending = bn(userInfo.rewardsInfo.purchasePending);

  const multiplier = currentBlock.minus(lastRewardBlock);
  if (currentBlock.gte(lastRewardBlock) && totalOrders.gt(0)) {
    const reward = multiplier.times(rewardPerBlock);
    _accRewardPerShare = _accRewardPerShare.plus(reward.div(totalOrders));
  }
  if (currentBlock.gte(lastRewardBlock) && totalBonusOrders.gt(0)) {
    const bonusReward = multiplier.times(bonusRewardPerBlock);
    _accBonusRewardPerShare = _accBonusRewardPerShare.plus(bonusReward.div(totalBonusOrders));
  }
  if (currentBlock.gte(lastRewardBlock) && totalFees.gt(0)) {
    const saleReward = multiplier.times(saleRewardPerBlock);
    const purchaseReward = multiplier.times(purchaseRewardPerBlock);
    _accSaleRewardPerShare = _accSaleRewardPerShare.plus(saleReward.div(totalFees));
    _accPurchaseRewardPerShare = _accPurchaseRewardPerShare.plus(purchaseReward.div(totalFees));
  }

  const reward = numOrders.times(_accRewardPerShare).minus(rewardDebt);
  const bonusReward = numBonusOrders.times(_accBonusRewardPerShare).minus(bonusRewardDebt);
  const saleReward = salesFeesTotal.times(_accSaleRewardPerShare).minus(saleRewardDebt);
  const purchaseReward = purchasesFeesTotal.times(_accPurchaseRewardPerShare).minus(purchaseRewardDebt);

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
    numBonusOffers: numBonusOffers.toString()
  };

  let netReward = grossReward;
  let penalty = bn(0);
  if (penaltyActivated) {
    const salesRatio = numSales.div(numOrders.plus(numBonusOrders));
    penalty = penaltyRatio.minus(salesRatio).times(grossReward);
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
    .then((resp) => {
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
const mailCreds = require('./creds/nftc-web-nodemailer-creds.json');

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
  await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .set(
      {
        profileInfo: {
          email: {
            address: email,
            verificationGuid: guid
          }
        }
      },
      { merge: true }
    );

  // send email
  const subject = 'Verify your email for NFT Company';
  const link = constants.API_BASE + '/verifyEmail?email=' + email + '&user=' + user + '&guid=' + guid;
  const html =
    '<p>Click the below link to verify your email</p> <br>' + '<a href=' + link + ' target="_blank">' + link + '</a>';
  sendEmail(email, subject, html);
  res.sendStatus(200);
});

app.get('/verifyEmail', async (req, res) => {
  const user = req.query.user.trim().toLowerCase();
  const email = req.query.email.trim().toLowerCase();
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
  let link = constants.API_BASE;
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

  const html = '<p>See it here:</p> <br>' + '<a href=' + link + ' target="_blank">' + link + '</a>';
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
  return +num.toString().match(/^-?\d+(?:\.\d{0,5})?/)[0];
}

function bn(num) {
  return BigNumber(num);
}
