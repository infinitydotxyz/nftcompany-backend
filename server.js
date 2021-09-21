require('dotenv').config();
const { ethers } = require('ethers');
const ethersProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);

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
        utils.log('Newly fetched firestore global info: ' + utils.jsonString(globalDoc.data()));
        // reconcile globalinfo
        const newInfo = reconcileGlobalInfo(globalDoc.data());
        await txn.update(globalDocRef, newInfo);
        return newInfo;
      });
      origLocalInfo = JSON.parse(JSON.stringify(globalInfo));
      utils.log('Reconciled global info: ' + utils.jsonString(globalInfo));
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
  utils.log('Local info delta: ' + utils.jsonString(localInfoDelta));

  newInfo.updatedAt = Date.now();
  newInfo.totalSales = bn(newInfo.totalSales).add(localInfoDelta.totalSales).toString();
  newInfo.totalFees = bn(newInfo.totalFees).add(localInfoDelta.totalFees).toString();
  newInfo.totalVolume = bn(newInfo.totalVolume).add(localInfoDelta.totalVolume).toString();
  newInfo.totalListings = bn(newInfo.totalListings).add(localInfoDelta.totalListings).toString();
  newInfo.totalBonusListings = bn(newInfo.totalBonusListings).add(localInfoDelta.totalBonusListings).toString();
  newInfo.totalOffers = bn(newInfo.totalOffers).add(localInfoDelta.totalOffers).toString();
  newInfo.totalBonusOffers = bn(newInfo.totalBonusOffers).add(localInfoDelta.totalBonusOffers).toString();

  newInfo.rewardsInfo.accRewardPerShare = bn(newInfo.rewardsInfo.accRewardPerShare)
    .add(localInfoDelta.rewardsInfo.accRewardPerShare)
    .toString();
  newInfo.rewardsInfo.accBonusRewardPerShare = bn(newInfo.rewardsInfo.accBonusRewardPerShare)
    .add(localInfoDelta.rewardsInfo.accBonusRewardPerShare)
    .toString();
  newInfo.rewardsInfo.accSaleRewardPerShare = bn(newInfo.rewardsInfo.accSaleRewardPerShare)
    .add(localInfoDelta.rewardsInfo.accSaleRewardPerShare)
    .toString();
  newInfo.rewardsInfo.accPurchaseRewardPerShare = bn(newInfo.rewardsInfo.accPurchaseRewardPerShare)
    .add(localInfoDelta.rewardsInfo.accPurchaseRewardPerShare)
    .toString();
  newInfo.rewardsInfo.totalRewardPaid = bn(newInfo.rewardsInfo.totalRewardPaid)
    .add(localInfoDelta.rewardsInfo.totalRewardPaid)
    .toString();
  newInfo.rewardsInfo.totalBonusRewardPaid = bn(newInfo.rewardsInfo.totalBonusRewardPaid)
    .add(localInfoDelta.rewardsInfo.totalBonusRewardPaid)
    .toString();
  newInfo.rewardsInfo.totalSaleRewardPaid = bn(newInfo.rewardsInfo.totalSaleRewardPaid)
    .add(localInfoDelta.rewardsInfo.totalSaleRewardPaid)
    .toString();
  newInfo.rewardsInfo.totalPurchaseRewardPaid = bn(newInfo.rewardsInfo.totalPurchaseRewardPaid)
    .add(localInfoDelta.rewardsInfo.totalPurchaseRewardPaid)
    .toString();

  if (bn(newInfo.rewardsInfo.lastRewardBlock).lt(localInfo.rewardsInfo.lastRewardBlock)) {
    newInfo.rewardsInfo.lastRewardBlock = bn(localInfo.rewardsInfo.lastRewardBlock).toString();
  }
  return newInfo;
}

function getLocalInfoDelta() {
  const localInfoDelta = getEmptyGlobalInfo();
  localInfoDelta.rewardsInfo = getEmptyGlobalInfo().rewardsInfo;

  localInfoDelta.totalSales = bn(localInfo.totalSales).sub(origLocalInfo.totalSales);
  localInfoDelta.totalFees = bn(localInfo.totalFees).sub(origLocalInfo.totalFees);
  localInfoDelta.totalVolume = bn(localInfo.totalVolume).sub(origLocalInfo.totalVolume);
  localInfoDelta.totalListings = bn(localInfo.totalListings).sub(origLocalInfo.totalListings);
  localInfoDelta.totalBonusListings = bn(localInfo.totalBonusListings).sub(origLocalInfo.totalBonusListings);
  localInfoDelta.totalOffers = bn(localInfo.totalOffers).sub(origLocalInfo.totalOffers);
  localInfoDelta.totalBonusOffers = bn(localInfo.totalBonusOffers).sub(origLocalInfo.totalBonusOffers);

  localInfoDelta.rewardsInfo.accRewardPerShare = bn(localInfo.rewardsInfo.accRewardPerShare).sub(
    origLocalInfo.rewardsInfo.accRewardPerShare
  );

  localInfoDelta.rewardsInfo.accBonusRewardPerShare = bn(localInfo.rewardsInfo.accBonusRewardPerShare).sub(
    origLocalInfo.rewardsInfo.accBonusRewardPerShare
  );

  localInfoDelta.rewardsInfo.accSaleRewardPerShare = bn(localInfo.rewardsInfo.accSaleRewardPerShare).sub(
    origLocalInfo.rewardsInfo.accSaleRewardPerShare
  );

  localInfoDelta.rewardsInfo.accPurchaseRewardPerShare = bn(localInfo.rewardsInfo.accPurchaseRewardPerShare).sub(
    origLocalInfo.rewardsInfo.accPurchaseRewardPerShare
  );

  localInfoDelta.rewardsInfo.totalRewardPaid = bn(localInfo.rewardsInfo.totalRewardPaid).sub(
    origLocalInfo.rewardsInfo.totalRewardPaid
  );

  localInfoDelta.rewardsInfo.totalBonusRewardPaid = bn(localInfo.rewardsInfo.totalBonusRewardPaid).sub(
    origLocalInfo.rewardsInfo.totalBonusRewardPaid
  );

  localInfoDelta.rewardsInfo.totalSaleRewardPaid = bn(localInfo.rewardsInfo.totalSaleRewardPaid).sub(
    origLocalInfo.rewardsInfo.totalSaleRewardPaid
  );

  localInfoDelta.rewardsInfo.totalPurchaseRewardPaid = bn(localInfo.rewardsInfo.totalPurchaseRewardPaid).sub(
    origLocalInfo.rewardsInfo.totalPurchaseRewardPaid
  );

  return localInfoDelta;
}

// =========================================== Server ===========================================================

app.all('/u/*', async (req, res, next) => {
  let authorized = await utils.authorizeUser(
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
  const price = +req.query.price || DEFAULT_MAX_ETH; // add a default max of 5000 eth
  const sortByPrice = `${req.query.sortByPrice || 'asc'}`.toLowerCase(); // ascending default
  const { limit, startAfterPrice, startAfter, error } = utils.parseQueryFields(
    res,
    req,
    ['limit', 'startAfterPrice', 'startAfter'],
    [`${DEFAULT_ITEMS_PER_PAGE}`, sortByPrice === 'asc' ? '0' : `${price}`, `${Date.now()}`]
  );
  if (error) {
    return;
  }
  // console.log('/listings params:', price, sortByPrice, limit, startAfter, startAfterPrice)
  db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where('metadata.basePriceInEth', '<=', +price)
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

//fetch items bought by user
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

//fetch items sold by user
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

//fetch offer made by user
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

//fetch offer received by user
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
  const maker = req.query.maker.trim().toLowerCase();
  const docId = req.query.id.trim(); // preserve case
  const side = +req.query.side;
  try {
    let collection = fstrCnstnts.LISTINGS_COLL;
    if (side == 0) {
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
      let orders = [];
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
});

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

//fetch rewards leaderboard
app.get('/rewards/leaderboard', async (req, res) => {
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .orderBy('rewardsInfo.grossRewardNumeric', 'desc')
    .limit(10)
    .get()
    .then((data) => {
      let results = [];
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
  const price = req.query.price || '5000'; // add a default max of 5000 eth
  const sortByPrice = req.query.sortByPrice || 'desc'; // descending default
  db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where('metadata.basePriceInEth', '<=', +price)
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

app.get('/u/:user/wyvern/v1/pendingtxns', async (req, res) => {
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
      .collection(fstrCnstnts.PENDING_TXNS_COLL)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .startAfter(startAfter)
      .limit(limit)
      .get();

    const txns = [];
    for (doc of snapshot.docs) {
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
    const userInfo = await getUserInfoAndUpdatedUserRewards(maker, hasBonus, numOrders, 0, true);

    if (userInfo.rewardsInfo) {
      // update user rewards data
      storeUpdatedUserRewards(batch, maker, userInfo.rewardsInfo);
    } else {
      utils.log('Not updating rewards data as there are no updates');
    }

    if (payload.side == 1) {
      // listing
      await postListing(maker, payload, batch, numOrders, hasBonus);
    } else if (payload.side == 0) {
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

// save pending txn
// called on buy now, accept offer, cancel offer, cancel listing
app.post('/u/:user/wyvern/v1/pendingtxns', async (req, res) => {
  try {
    const payload = req.body;
    const user = req.params.user.trim().toLowerCase();

    // input checking
    let inputError = '';
    const actionType = payload.actionType.trim().toLowerCase(); // either fulfill or cancel
    if (actionType != 'fulfill' && actionType != 'cancel') {
      inputError += 'Invalid actionType: ' + actionType + ' ';
    }

    const txnHash = payload.txnHash.trim(); // preserve case
    if (!txnHash) {
      inputError += 'Payload does not have txnHash ';
    }

    const side = +payload.side;
    if (side != 0 && side != 1) {
      inputError += 'Unknown order side: ' + side + ' ';
    }

    const orderId = payload.orderId.trim(); // preserve case
    if (!orderId) {
      inputError += 'Payload does not have orderId ';
    }

    // input checking for fulfill action
    if (actionType == 'fulfill') {
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
      .collection(fstrCnstnts.PENDING_TXNS_COLL)
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
    .collection(fstrCnstnts.PENDING_TXNS_COLL);

  const origTxnDocRef = userPendingTxnCollRef.doc(origTxnHash);
  const confirms = 1;

  try {
    const receipt = await ethersProvider.waitForTransaction(origTxnHash, confirms);
    // orig txn confirmed
    utils.log('Txn: ' + origTxnHash + ' confirmed after ' + confirms + ' block(s)');
    const txnData = JSON.parse(utils.jsonString(receipt));
    batch.set(origTxnDocRef, { status: 'confirmed', txnData }, { merge: true });
    if (actionType == 'fulfill') {
      await fulfillOrder(user, batch, payload);
    } else if (actionType == 'cancel') {
      const docId = payload.orderId.trim(); // preserve case
      const side = +payload.side;
      if (side == 0) {
        await cancelOffer(user, batch, docId);
      } else if (side == 1) {
        await cancelListing(user, batch, docId);
      }
    }
  } catch (err) {
    utils.error('Txn: ' + origTxnHash + ' was rejected');
    // if the txn failed, err.receipt.status = 0
    if (err.receipt && err.receipt.status == 0) {
      utils.error('Txn with hash: ' + txnHash + ' rejected');
      utils.error(err);

      const txnData = JSON.parse(utils.jsonString(err.receipt));
      batch.set(origTxnDocRef, { status: 'rejected', txnData }, { merge: true });
    }
    // if the txn failed due to replacement or cancellation or repricing
    if (err && err.reason && err.replacement) {
      utils.error('Txn with hash: ' + txnHash + ' rejected with reason ' + err.reason);
      utils.error(err);

      const replacementTxnHash = err.replacement.hash;
      if (err.reason == 'cancelled') {
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

    if (side != 0 && side != 1) {
      utils.error('Unknown order side ' + side + ' , not fulfilling it');
      return;
    }

    if (side == 0) {
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
    } else if (side == 1) {
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

      // send email to maker that the listing is bought
      prepareEmail(maker, doc, 'listingBought');
    }

    // update total sales
    incrementLocalStats({ totalSales: numOrders });

    //update total fees
    incrementLocalStats({ totalFees: feesInEth });

    //update total volume
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
  const userInfo = await getUserInfoAndUpdatedUserRewards(user, false, numOrders, purchaseFees, true);

  if (userInfo.rewardsInfo) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, userInfo.rewardsInfo);
  } else {
    utils.log('Not updating rewards data as there are no updates');
  }

  // update user txn stats
  const purchasesTotal = bn(userInfo.purchasesTotal).add(salePriceInEth).toString();
  const purchasesFeesTotal = bn(userInfo.purchasesFeesTotal).add(purchaseFees).toString();
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
  const userInfo = await getUserInfoAndUpdatedUserRewards(user, false, numOrders, feesInEth, true);

  if (userInfo.rewardsInfo) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, userInfo.rewardsInfo);
  } else {
    utils.log('Not updating rewards data as there are no updates');
  }

  // update user txn stats
  const salesTotal = bn(userInfo.salesTotal).add(salePriceInEth).toString();
  const salesFeesTotal = bn(userInfo.salesFeesTotal).add(feesInEth).toString();
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
  if (side == 0) {
    //offers
    batch.set(ref, { numOffers: firebaseAdmin.firestore.FieldValue.increment(num) }, { merge: true });
    if (hasBonus) {
      batch.set(ref, { numBonusOffers: firebaseAdmin.firestore.FieldValue.increment(num) }, { merge: true });
    }
  } else if (side == 1) {
    // listings
    batch.set(ref, { numListings: firebaseAdmin.firestore.FieldValue.increment(num) }, { merge: true });
    if (hasBonus) {
      batch.set(ref, { numBonusListings: firebaseAdmin.firestore.FieldValue.increment(num) }, { merge: true });
    }
  }
}

function updateNumTotalOrders(num, hasBonus, side) {
  utils.log('Updating num total orders');
  let totalOffers = 0,
    totalBonusOffers = 0,
    totalListings = 0,
    totalBonusListings = 0;

  if (side == 0) {
    totalOffers = num;
    if (hasBonus) {
      totalBonusOffers = num;
    }
  } else if (side == 1) {
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
  return;
}

async function getAssetsFromAlchemy(address, limit, offset) {
  utils.log('Fetching assets from alchemy');
  return;
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
    return;
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
    return;
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
  if (orderExpirationTime == 0) {
    //special case of never expire
    return false;
  }
  return orderExpirationTime <= utcSecondsSinceEpoch;
}

function deleteExpiredOrder(doc) {
  utils.log('Deleting expired order', doc.id);
  const order = doc.data();
  const side = +order.side;
  const batch = db.batch();
  if (side == 1) {
    // listing
    deleteListing(batch, doc.ref);
  } else if (side == 0) {
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

  const userInfo = await getUserInfoAndUpdatedUserRewards(user, hasBonus, numOrders, 0, false);

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

  const userInfo = await getUserInfoAndUpdatedUserRewards(user, hasBonus, numOrders, 0, false);

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
  localInfo.totalOffers = bn(localInfo.totalOffers).add(totalOffers || 0);
  localInfo.totalBonusOffers = bn(localInfo.totalBonusOffers).add(totalBonusOffers || 0);
  localInfo.totalListings = bn(localInfo.totalListings).add(totalListings || 0);
  localInfo.totalBonusListings = bn(localInfo.totalBonusListings).add(totalBonusListings || 0);
  localInfo.totalFees = bn(localInfo.totalFees).add(totalFees || 0);
  localInfo.totalVolume = bn(localInfo.totalVolume).add(totalVolume || 0);
  localInfo.totalSales = bn(localInfo.totalSales).add(totalSales || 0);
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

async function getUserInfoAndUpdatedUserRewards(user, hasBonus, numOrders, fees, isIncrease) {
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

  const updatedUserRewards = updateRewards(userInfo, hasBonus, numOrders, fees, isIncrease);
  if (!updatedUserRewards) {
    userInfo.rewardsInfo = null;
  }
  return userInfo;
}

function getEmptyGlobalInfo() {
  return {
    totalListings: bn(0),
    totalBonusListings: bn(0),
    totalOffers: bn(0),
    totalBonusOffers: bn(0),
    totalSales: bn(0),
    totalFees: bn(0),
    totalVolume: bn(0),
    rewardsInfo: {
      accRewardPerShare: bn(0),
      accBonusRewardPerShare: bn(0),
      accSaleRewardPerShare: bn(0),
      accPurchaseRewardPerShare: bn(0),
      rewardPerBlock: bn(0),
      bonusRewardPerBlock: bn(0),
      saleRewardPerBlock: bn(0),
      purchaseRewardPerBlock: bn(0),
      totalRewardPaid: bn(0),
      totalBonusRewardPaid: bn(0),
      totalSaleRewardPaid: bn(0),
      totalPurchaseRewardPaid: bn(0),
      lastRewardBlock: bn(0),
      penaltyActivated: true,
      penaltyRatio: bn(0.99)
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
    numListings: bn(0),
    numBonusListings: bn(0),
    numOffers: bn(0),
    numBonusOffers: bn(0),
    numPurchases: bn(0),
    numSales: bn(0),
    salesTotal: bn(0),
    salesFeesTotal: bn(0),
    purchasesTotal: bn(0),
    purchasesFeesTotal: bn(0),
    salesTotalNumeric: 0,
    salesFeesTotalNumeric: 0,
    purchasesTotalNumeric: 0,
    purchasesFeesTotalNumeric: 0,
    rewardsInfo: getEmptyUserRewardInfo()
  };
}

function getEmptyUserRewardInfo() {
  return {
    rewardDebt: bn(0),
    bonusRewardDebt: bn(0),
    saleRewardDebt: bn(0),
    purchaseRewardDebt: bn(0),
    pending: bn(0),
    bonusPending: bn(0),
    salePending: bn(0),
    purchasePending: bn(0),
    grossReward: bn(0),
    netReward: bn(0),
    grossRewardNumeric: 0,
    netRewardNumeric: 0,
    rewardCalculatedAt: Date.now()
  };
}

// updates totalRewardPaid, totalBonusRewardPaid, totalSaleRewardPaid, totalPurchaseRewardPaid and returns updated user rewards
async function updateRewards(userInfo, hasBonus, numOrders, fees, isIncrease) {
  utils.log('Updating rewards in increasing mode = ', isIncrease);

  let userShare = bn(userInfo.numListings).add(userInfo.numOffers);
  let userBonusShare = bn(userInfo.numBonusListings).add(userInfo.numBonusOffers);
  let salesFeesTotal = bn(userInfo.salesFeesTotal);
  let purchasesFeesTotal = bn(userInfo.purchasesFeesTotal);
  let rewardDebt = bn(userInfo.rewardsInfo.rewardDebt);
  let bonusRewardDebt = bn(userInfo.rewardsInfo.bonusRewardDebt);
  let saleRewardDebt = bn(userInfo.rewardsInfo.saleRewardDebt);
  let purchaseRewardDebt = bn(userInfo.rewardsInfo.purchaseRewardDebt);
  let pending = bn(0);
  let bonusPending = bn(0);
  let salePending = bn(0);
  let purchasePending = bn(0);

  const result = await updateLocalRewards();
  if (!result) {
    utils.log('Not updating rewards');
    return;
  }

  const accRewardPerShare = bn(localInfo.rewardsInfo.accRewardPerShare);
  const accSaleRewardPerShare = bn(localInfo.rewardsInfo.accSaleRewardPerShare);
  const accPurchaseRewardPerShare = bn(localInfo.rewardsInfo.accPurchaseRewardPerShare);
  const accBonusRewardPerShare = bn(localInfo.rewardsInfo.accBonusRewardPerShare);

  if (!isIncrease) {
    if (userShare.gte(numOrders)) {
      pending = userShare.mul(accRewardPerShare).sub(rewardDebt);
      // decrease before reward debt calc
      userShare = userShare.sub(numOrders);
    }
    if (salesFeesTotal.gte(fees)) {
      salePending = salesFeesTotal.mul(accSaleRewardPerShare).sub(saleRewardDebt);
      salesFeesTotal = salesFeesTotal.sub(fees);
    }
    if (purchasesFeesTotal.gte(fees)) {
      purchasePending = purchasesFeesTotal.mul(accPurchaseRewardPerShare).sub(purchaseRewardDebt);
      purchasesFeesTotal = purchasesFeesTotal.sub(fees);
    }
  } else {
    if (userShare.gte(0)) {
      pending = userShare.mul(accRewardPerShare).sub(rewardDebt);
    }
    if (salesFeesTotal.gte(0)) {
      salePending = salesFeesTotal.mul(accSaleRewardPerShare).sub(saleRewardDebt);
    }
    if (purchasesFeesTotal.gte(0)) {
      purchasePending = purchasesFeesTotal.mul(accPurchaseRewardPerShare).sub(purchaseRewardDebt);
    }
    // increase before reward debt calc
    userShare = userShare.add(numOrders);
    salesFeesTotal = salesFeesTotal.add(fees);
    purchasesFeesTotal = purchasesFeesTotal.add(fees);
  }
  userInfo.rewardsInfo.rewardDebt = userShare.mul(accRewardPerShare).toString();
  userInfo.rewardsInfo.pending = pending.toString();
  userInfo.rewardsInfo.saleRewardDebt = salesFeesTotal.mul(accSaleRewardPerShare).toString();
  userInfo.rewardsInfo.salePending = salePending.toString();
  userInfo.rewardsInfo.purchaseRewardDebt = purchasesFeesTotal.mul(accPurchaseRewardPerShare).toString();
  userInfo.rewardsInfo.purchasePending = purchasePending.toString();

  if (hasBonus) {
    if (!isIncrease) {
      if (userBonusShare.gte(numOrders)) {
        bonusPending = userBonusShare.mul(accBonusRewardPerShare).sub(bonusRewardDebt);
        // decrease userShare before rewardDebt calc
        userBonusShare = userBonusShare.sub(numOrders);
      }
    } else {
      if (userBonusShare.gt(0)) {
        bonusPending = userBonusShare.mul(accBonusRewardPerShare).sub(bonusRewardDebt);
      }
      // add current value before reward debt calc
      userBonusShare = userBonusShare.add(numOrders);
    }
    userInfo.rewardsInfo.bonusRewardDebt = userBonusShare.mul(accBonusRewardPerShare).toString();
    userInfo.rewardsInfo.bonusPending = bonusPending.toString();
  }

  // update local info
  localInfo.rewardsInfo.totalRewardPaid = pending.add(localInfo.rewardsInfo.totalRewardPaid);
  localInfo.rewardsInfo.totalBonusRewardPaid = bonusPending.add(localInfo.rewardsInfo.totalBonusRewardPaid);
  localInfo.rewardsInfo.totalSaleRewardPaid = salePending.add(localInfo.rewardsInfo.totalSaleRewardPaid);
  localInfo.rewardsInfo.totalPurchaseRewardPaid = purchasePending.add(localInfo.rewardsInfo.totalPurchaseRewardPaid);

  return userInfo.rewardsInfo;
}

// updates lastRewardBlock, accRewardPerShare, accBonusRewardPerShare
async function updateLocalRewards() {
  utils.log('Updating local rewards');
  const currentBlock = await getCurrentBlock();
  const totalOrders = bn(globalInfo.totalListings).add(globalInfo.totalOffers);
  const totalBonusOrders = bn(globalInfo.totalBonusListings).add(globalInfo.totalBonusOffers);
  const totalFees = bn(globalInfo.totalFees);
  const rewardPerBlock = bn(globalInfo.rewardsInfo.rewardPerBlock);
  const bonusRewardPerBlock = bn(globalInfo.rewardsInfo.bonusRewardPerBlock);
  const saleRewardPerBlock = bn(globalInfo.rewardsInfo.saleRewardPerBlock);
  const purchaseRewardPerBlock = bn(globalInfo.rewardsInfo.purchaseRewardPerBlock);

  const accRewardPerShare = bn(localInfo.rewardsInfo.accRewardPerShare);
  const accBonusRewardPerShare = bn(localInfo.rewardsInfo.accBonusRewardPerShare);
  const accSaleRewardPerShare = bn(localInfo.rewardsInfo.accSaleRewardPerShare);
  const accPurchaseRewardPerShare = bn(localInfo.rewardsInfo.accPurchaseRewardPerShare);

  let lastRewardBlock = bn(localInfo.rewardsInfo.lastRewardBlock);

  if (currentBlock.lte(lastRewardBlock)) {
    utils.log('Not updating global rewards since current block <= lastRewardBlock');
    return false;
  }
  if (totalOrders.eq(0)) {
    utils.log('Not updating global rewards since total liquidity is 0');
    return false;
  }
  const multiplier = currentBlock.sub(lastRewardBlock);
  const reward = multiplier.mul(rewardPerBlock);
  localInfo.rewardsInfo.accRewardPerShare = accRewardPerShare.add(reward.div(totalOrders));
  if (totalBonusOrders.gte(0)) {
    const bonusReward = multiplier.mul(bonusRewardPerBlock);
    localInfo.rewardsInfo.accBonusRewardPerShare = accBonusRewardPerShare.add(bonusReward.div(totalBonusOrders));
  }
  if (totalFees.gte(0)) {
    const saleReward = multiplier.mul(saleRewardPerBlock);
    localInfo.rewardsInfo.accSaleRewardPerShare = accSaleRewardPerShare.add(saleReward.div(totalFees));
    const purchaseReward = multiplier.mul(purchaseRewardPerBlock);
    localInfo.rewardsInfo.accPurchaseRewardPerShare = accPurchaseRewardPerShare.add(purchaseReward.div(totalFees));
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
  const totalOrders = bn(globalInfo.totalListings).add(globalInfo.totalOffers);
  const totalBonusOrders = bn(globalInfo.totalBonusListings).add(globalInfo.totalBonusOffers);
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
  const numOrders = bn(userInfo.numListings).add(userInfo.numOffers);
  const numBonusOrders = bn(userInfo.numBonusListings).add(userInfo.numBonusOffers);

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

  const multiplier = currentBlock.sub(lastRewardBlock);
  if (currentBlock.gte(lastRewardBlock) && totalOrders.gt(0)) {
    const reward = multiplier.mul(rewardPerBlock);
    _accRewardPerShare = _accRewardPerShare.add(reward.div(totalOrders));
  }
  if (currentBlock.gte(lastRewardBlock) && totalBonusOrders.gt(0)) {
    const bonusReward = multiplier.mul(bonusRewardPerBlock);
    _accBonusRewardPerShare = _accBonusRewardPerShare.add(bonusReward.div(totalBonusOrders));
  }
  if (currentBlock.gte(lastRewardBlock) && totalFees.gt(0)) {
    const saleReward = multiplier.mul(saleRewardPerBlock);
    const purchaseReward = multiplier.mul(purchaseRewardPerBlock);
    _accSaleRewardPerShare = _accSaleRewardPerShare.add(saleReward.div(totalFees));
    _accPurchaseRewardPerShare = _accPurchaseRewardPerShare.add(purchaseReward.div(totalFees));
  }

  const reward = numOrders.mul(_accRewardPerShare).sub(rewardDebt);
  const bonusReward = numBonusOrders.mul(_accBonusRewardPerShare).sub(bonusRewardDebt);
  const saleReward = salesFeesTotal.mul(_accSaleRewardPerShare).sub(saleRewardDebt);
  const purchaseReward = purchasesFeesTotal.mul(_accPurchaseRewardPerShare).sub(purchaseRewardDebt);

  const grossReward = reward
    .add(bonusReward)
    .add(saleReward)
    .add(purchaseReward)
    .add(pending)
    .add(bonusPending)
    .add(salePending)
    .add(purchasePending);
  
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
    const salesRatio = numSales.div(numOrders.add(numBonusOrders));
    penalty = penaltyRatio.sub(salesRatio).mul(grossReward);
    // the edge case where all orders are fulfilled
    if (penalty.lt(0)) {
      penalty = bn(0);
    }
    netReward = netReward.sub(penalty);
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
const testReceiverEmailAddress = 'findadit@gmail.com';
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

  let data = userDoc.data();

  if (data?.profileInfo?.email?.address) {
    let resp = utils.jsonString(data.profileInfo.email);
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
  const userDoc = await db
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
  const link = 'http://localhost:9090/verifyEmail?email=' + email + '&user=' + user + '&guid=' + guid;
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
  if (storedEmail != email) {
    res.status(401).send('Wrong email');
    return;
  }
  // check guid
  const storedGuid = userDoc.data().profileInfo.email.verificationGuid;
  if (storedGuid != guid) {
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

// right now emails are sent when a listing is bought, offer is made or an offer is accepted
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

  let subject = '';
  let html = ''; //todo: adi
  if (type == 'offerMade') {
    subject = 'You received an offer on your listing.';
    html = '';
  } else if (type == 'offerAccepted') {
    subject = 'Your offer has been accepted.';
    html = '';
  } else if (type == 'listingBought') {
    subject = 'Your listing has been purchased.';
    html = '';
  } else {
    utils.error('Cannot prepare email for unknown action type');
    return;
  }
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
  return ethers.BigNumber.from(num);
}
