require('dotenv').config();
const { ethers } = require('ethers');
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
  setInterval(() => {
    const globalDocRef = db.collection(fstrCnstnts.ROOT_COLL).doc(fstrCnstnts.INFO_DOC);
    db.runTransaction(async (txn) => {
      const globalDoc = await txn.get(globalDocRef);
      // reconcile globalinfo
      reconcileGlobalInfo(globalDoc.data());
      txn.update(globalDocRef, globalInfo);
    })
      .then((res) => {
        origLocalInfo = JSON.parse(JSON.stringify(globalInfo));
      })
      .catch((err) => {
        utils.error('Failed updating global info in firestore', err);
        utils.error(err);
      });
  }, 1000 * 60); // every 60 seconds
}

function reconcileGlobalInfo(globalData) {
  globalInfo = { ...getEmptyGlobalInfo(), ...globalData };
  globalInfo.rewardsInfo = {
    ...getEmptyGlobalInfo().rewardsInfo,
    ...globalData.rewardsInfo
  };

  const localInfoDelta = getLocalInfoDelta();

  globalInfo.updatedAt = Date.now();
  globalInfo.totalSales += localInfoDelta.totalSales;
  globalInfo.totalFees += localInfoDelta.totalFees;
  globalInfo.totalVolume += localInfoDelta.totalVolume;
  globalInfo.totalListings += localInfoDelta.totalListings;
  globalInfo.totalBonusListings += localInfoDelta.totalBonusListings;
  globalInfo.totalOffers += localInfoDelta.totalOffers;
  globalInfo.totalBonusOffers += localInfoDelta.totalBonusOffers;

  globalInfo.rewardsInfo.accRewardPerShare += localInfoDelta.rewardsInfo.accRewardPerShare;
  globalInfo.rewardsInfo.accBonusRewardPerShare += localInfoDelta.rewardsInfo.accBonusRewardPerShare;
  globalInfo.rewardsInfo.accSaleRewardPerShare += localInfoDelta.rewardsInfo.accSaleRewardPerShare;
  globalInfo.rewardsInfo.accBuyRewardPerShare += localInfoDelta.rewardsInfo.accBuyRewardPerShare;
  globalInfo.rewardsInfo.totalRewardPaid += localInfoDelta.rewardsInfo.totalRewardPaid;
  globalInfo.rewardsInfo.totalBonusRewardPaid += localInfoDelta.rewardsInfo.totalBonusRewardPaid;
  globalInfo.rewardsInfo.totalSaleRewardPaid += localInfoDelta.rewardsInfo.totalSaleRewardPaid;
  globalInfo.rewardsInfo.totalBuyRewardPaid += localInfoDelta.rewardsInfo.totalBuyRewardPaid;

  if (globalInfo.rewardsInfo.lastRewardBlock < localInfo.rewardsInfo.lastRewardBlock) {
    globalInfo.rewardsInfo.lastRewardBlock = localInfo.rewardsInfo.lastRewardBlock;
  }
}

function getLocalInfoDelta() {
  const localInfoDelta = getEmptyGlobalInfo();
  localInfoDelta.rewardsInfo = getEmptyGlobalInfo().rewardsInfo;

  localInfoDelta.totalSales = localInfo.totalSales - origLocalInfo.totalSales;
  localInfoDelta.totalFees = localInfo.totalFees - origLocalInfo.totalFees;
  localInfoDelta.totalVolume = localInfo.totalVolume - origLocalInfo.totalVolume;
  localInfoDelta.totalListings = localInfo.totalListings - origLocalInfo.totalListings;
  localInfoDelta.totalBonusListings = localInfo.totalBonusListings - origLocalInfo.totalBonusListings;
  localInfoDelta.totalOffers = localInfo.totalOffers - origLocalInfo.totalOffers;
  localInfoDelta.totalBonusOffers = localInfo.totalBonusOffers - origLocalInfo.totalBonusOffers;

  localInfoDelta.rewardsInfo.accRewardPerShare =
    localInfo.rewardsInfo.accRewardPerShare - origLocalInfo.rewardsInfo.accRewardPerShare;

  localInfoDelta.rewardsInfo.accBonusRewardPerShare =
    localInfo.rewardsInfo.accBonusRewardPerShare - origLocalInfo.rewardsInfo.accBonusRewardPerShare;

  localInfoDelta.rewardsInfo.accSaleRewardPerShare =
    localInfo.rewardsInfo.accSaleRewardPerShare - origLocalInfo.rewardsInfo.accSaleRewardPerShare;

  localInfoDelta.rewardsInfo.accBuyRewardPerShare =
    localInfo.rewardsInfo.accBuyRewardPerShare - origLocalInfo.rewardsInfo.accBuyRewardPerShare;

  localInfoDelta.rewardsInfo.totalRewardPaid =
    localInfo.rewardsInfo.totalRewardPaid - origLocalInfo.rewardsInfo.totalRewardPaid;

  localInfoDelta.rewardsInfo.totalBonusRewardPaid =
    localInfo.rewardsInfo.totalBonusRewardPaid - origLocalInfo.rewardsInfo.totalBonusRewardPaid;

  localInfoDelta.rewardsInfo.totalSaleRewardPaid =
    localInfo.rewardsInfo.totalSaleRewardPaid - origLocalInfo.rewardsInfo.totalSaleRewardPaid;

  localInfoDelta.rewardsInfo.totalBuyRewardPaid =
    localInfo.rewardsInfo.totalBuyRewardPaid - origLocalInfo.rewardsInfo.totalBuyRewardPaid;

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

// ================================================ READ ===================================================================

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
    [`${DEFAULT_ITEMS_PER_PAGE}`, sortByPrice === 'asc' ? '0' : `${DEFAULT_MAX_ETH}`, `${Date.now()}`]
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
  const tokenAddress = req.query.assetContractAddress.trim().toLowerCase();
  const tokenId = req.query.tokenId;
  const side = req.query.side;
  try {
    const docs = await getOrders(maker, tokenAddress, tokenId, side);
    if (docs) {
      let orders = [];
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
  } catch (err) {
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
    .orderBy('rewardsInfo.netReward', 'desc')
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

//=============================================== WRITES =====================================================================

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
    const updatedRewards = await getUpdatedRewards(maker, hasBonus, numOrders, 0, true);

    if (updatedRewards) {
      // update user rewards data
      storeUpdatedUserRewards(batch, maker, updatedRewards);
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

// order fulfill
app.post('/u/:user/wyvern/v1/orders/:id/fulfill', async (req, res) => {
  // user is the taker of the order - either bought now or accepted offer
  // write to bought and sold and delete from listing, offer made, offer recvd
  /* cases in which order is fulfilled:
    1) listed an item and a buy now is made on it; order is the listing
    2) listed an item, offer received on it, offer is accepted; order is the offerReceived
    3) no listing made, but offer is received on it, offer is accepted; order is the offerReceived
  */
  try {
    const payload = req.body;
    const salePriceInEth = +payload.salePriceInEth;
    const side = +payload.side;
    const taker = req.params.user.trim().toLowerCase();
    const docId = req.params.id.trim(); // preserve case
    const feesInEth = +payload.feesInEth;
    const txnHash = payload.txnHash;

    const numOrders = 1;
    const batch = db.batch();

    if (side != 0 || side != 1) {
      utils.error('Unknown order type, not fulfilling it');
      res.sendStatus(500);
      return;
    }

    if (side == 0) {
      // taker accepted offerReceived, maker is the buyer

      // check if order exists
      const doc = await db
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(maker)
        .collection(fstrCnstnts.OFFERS_COLL)
        .doc(docId)
        .get();
      if (!doc.exists) {
        utils.log('No order ' + docId + ' to fulfill');
        res.sendStatus(404);
        return;
      }

      const maker = doc.maker.trim().toLowerCase();
      const isOfferMadeOnListing = doc.metadata.isOfferMadeOnListing;
      doc.taker = taker;
      doc.salePriceInEth = salePriceInEth;
      doc.feesInEth = feesInEth;
      doc.txnHash = txnHash;

      utils.log('Item bought by ' + maker + ' sold by ' + taker);

      // write to bought by maker; multiple items possible
      await saveBoughtOrder(maker, doc, batch, numOrders);

      // write to sold by taker; multiple items possible
      await saveSoldOrder(taker, doc, batch, numOrders);

      // delete offerMade by maker
      await deleteOfferMadeWithId(docId, maker, batch);

      // delete listing by taker if it exists
      if (isOfferMadeOnListing) {
        await deleteListingWithId(docId, taker, batch);
      }

      // send email to maker that the offer is accepted
      prepareEmail(maker, doc, 'offerAccepted');
    } else if (side == 1) {
      // taker bought a listing, maker is the seller

      // check if order exists
      const doc = await db
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(maker)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .doc(docId)
        .get();
      if (!doc.exists) {
        utils.log('No order ' + docId + ' to fulfill');
        res.sendStatus(404);
        return;
      }

      const maker = doc.maker.trim().toLowerCase();
      doc.taker = taker;
      doc.salePriceInEth = salePriceInEth;
      doc.feesInEth = feesInEth;
      doc.txnHash = txnHash;

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

    // commit batch
    batch
      .commit()
      .then((resp) => {
        res.sendStatus(200);
      })
      .catch((err) => {
        utils.error('Failed to fulfill order', err);
        res.sendStatus(500);
      });
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// ====================================================== DELETES ======================================================

// cancel listing
app.delete('/u/:user/listings/:listing', async (req, res) => {
  // delete listing and any offers recvd
  try {
    const user = req.params.user.trim().toLowerCase();
    const listing = req.params.listing.trim(); // preserve case

    // check if listing exists first
    const listingRef = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.LISTINGS_COLL)
      .doc(listing);
    const doc = await listingRef.get();
    if (!doc.exists) {
      utils.log('No listing ' + listing + ' to delete');
      res.sendStatus(404);
      return;
    }

    const batch = db.batch();
    await deleteListing(batch, listingRef);
    // commit batch
    batch
      .commit()
      .then((resp) => {
        res.sendStatus(200);
      })
      .catch((err) => {
        utils.error('Failed to delete listing', err);
        res.sendStatus(500);
      });
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// cancel offer
app.delete('/u/:user/offers/:offer', async (req, res) => {
  try {
    // delete offer
    const user = req.params.user.trim().toLowerCase();
    const offer = req.params.offer.trim(); // preserve case

    // check if offer exists first
    const offerRef = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.OFFERS_COLL)
      .doc(offer);
    const doc = await offerRef.get();
    if (!doc.exists) {
      utils.log('No offer ' + offer + ' to delete');
      res.sendStatus(404);
      return;
    }

    const batch = db.batch();
    await deleteOffer(batch, offerRef);
    // commit batch
    batch
      .commit()
      .then((resp) => {
        res.sendStatus(200);
      })
      .catch((err) => {
        utils.error('Failed to delete offer', err);
        res.sendStatus(500);
      });
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// ====================================================== Write helpers ==========================================================

async function saveBoughtOrder(user, order, batch, numOrders) {
  // save order
  order.metadata.createdAt = Date.now();
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.PURCHASES_COLL)
    .doc();
  batch.set(ref, order, { merge: true });

  const fees = order.metadata.feesInEth;
  const buyFees = Math.round(fees / 5);
  // update rewards first; before stats
  const updatedRewards = await getUpdatedRewards(user, false, numOrders, buyFees, true);

  if (updatedRewards) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, updatedRewards);
  } else {
    utils.log('Not updating rewards data as there are no updates');
  }

  // update num user bought
  const numBoughtRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  batch.set(numBoughtRef, { numBought: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
}

async function saveSoldOrder(user, order, batch, numOrders) {
  order.metadata.createdAt = Date.now();
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.SALES_COLL)
    .doc();
  batch.set(ref, order, { merge: true });

  const fees = order.metadata.feesInEth;
  // update rewards first; before stats
  const updatedRewards = await getUpdatedRewards(user, false, numOrders, fees, true);

  if (updatedRewards) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, updatedRewards);
  } else {
    utils.log('Not updating rewards data as there are no updates');
  }

  // update num user sold
  const numSoldRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  batch.set(numSoldRef, { numSold: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
}

async function postListing(maker, payload, batch, numOrders, hasBonus) {
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

async function getOrders(maker, tokenAddress, tokenId, side) {
  utils.log('Fetching order for', maker, tokenAddress, tokenId, side);
  let collection = fstrCnstnts.LISTINGS_COLL;
  if (0 == parseInt(side)) {
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
    return;
  }
  return results.docs;
}

// ==================================================== Update num orders ===============================================

function updateNumOrders(batch, user, num, hasBonus, side) {
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

// ================================================== Update rewards =========================================================

function incrementLocalStats({
  totalOffers,
  totalBonusOffers,
  totalListings,
  totalBonusListings,
  totalFees,
  totalVolume,
  totalSales
}) {
  localInfo.totalOffers += totalOffers || 0;
  localInfo.totalBonusOffers += totalBonusOffers || 0;
  localInfo.totalListings += totalListings || 0;
  localInfo.totalBonusListings += totalBonusListings || 0;
  localInfo.totalFees += totalFees || 0;
  localInfo.totalVolume += totalVolume || 0;
  localInfo.totalSales += totalSales || 0;
}

function storeUpdatedUserRewards(batch, user, data) {
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  batch.set(ref, { rewardsInfo: data, updatedAt: Date.now() }, { merge: true });
}

// ==================================================== Get assets ==========================================================

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

// ============================================= Delete helpers ==========================================================

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
  const listing = doc.id;
  utils.log('Deleting listing', listing);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  const updatedRewards = await getUpdatedRewards(user, hasBonus, numOrders, 0, false);

  if (updatedRewards) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, updatedRewards);
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

  const updatedRewards = await getUpdatedRewards(user, hasBonus, numOrders, 0, false);

  if (updatedRewards) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, updatedRewards);
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

async function hasBonusReward(address) {
  const doc = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
    .doc(address)
    .get();
  return doc.exists;
}

async function getUpdatedRewards(user, hasBonus, numOrders, fees, isIncrease) {
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

  let updatedRewards = updateRewards(userInfo, hasBonus, numOrders, fees, isIncrease);
  return updatedRewards;
}

function getEmptyGlobalInfo() {
  return {
    totalListings: 0,
    totalBonusListings: 0,
    totalOffers: 0,
    totalBonusOffers: 0,
    totalSales: 0,
    totalFees: 0,
    totalVolume: 0,
    rewardsInfo: {
      accRewardPerShare: 0,
      accBonusRewardPerShare: 0,
      accSaleRewardPerShare: 0,
      accBuyRewardPerShare: 0,
      rewardPerBlock: 0,
      bonusRewardPerBlock: 0,
      saleRewardPerBlock: 0,
      buyRewardPerBlock: 0,
      totalRewardPaid: 0,
      totalBonusRewardPaid: 0,
      totalSaleRewardPaid: 0,
      totalBuyRewardPaid: 0,
      lastRewardBlock: 0,
      penaltyActivated: true,
      penaltyRatio: 0.99
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
    numListings: 0,
    numBonusListings: 0,
    numOffers: 0,
    numBonusOffers: 0,
    numBought: 0,
    numSold: 0,
    saleFees: 0,
    buyFees: 0,
    rewardsInfo: getEmptyUserRewardInfo()
  };
}

function getEmptyUserRewardInfo() {
  return {
    rewardDebt: 0,
    bonusRewardDebt: 0,
    saleRewardDebt: 0,
    buyRewardDebt: 0,
    pending: 0,
    bonusPending: 0,
    salePending: 0,
    buyPending: 0,
    netReward: 0,
    netRewardCalculatedAt: 0
  };
}

// updates totalRewardPaid, totalBonusRewardPaid, totalSaleRewardPaid, totalBuyRewardPaid and returns user share
async function updateRewards(userInfo, hasBonus, numOrders, fees, isIncrease) {
  utils.log('Updating rewards in increasing mode = ', isIncrease);

  let userShare = userInfo.numListings + userInfo.numOffers;
  let userBonusShare = userInfo.numBonusListings + userInfo.numBonusOffers;
  let saleFees = userInfo.saleFees;
  let buyFees = userInfo.buyFees;
  let rewardDebt = userInfo.rewardsInfo.rewardDebt;
  let bonusRewardDebt = userInfo.rewardsInfo.bonusRewardDebt;
  let saleRewardDebt = userInfo.rewardsInfo.saleRewardDebt;
  let buyRewardDebt = userInfo.rewardsInfo.buyRewardDebt;
  let pending = 0;
  let bonusPending = 0;
  let salePending = 0;
  let buyPending = 0;

  const result = await updateLocalRewards();
  if (!result) {
    utils.log('Not updating rewards');
    return;
  }

  const accRewardPerShare = localInfo.rewardsInfo.accRewardPerShare;
  const accSaleRewardPerShare = localInfo.rewardsInfo.accSaleRewardPerShare;
  const accBuyRewardPerShare = localInfo.rewardsInfo.accBuyRewardPerShare;
  const accBonusRewardPerShare = localInfo.rewardsInfo.accBonusRewardPerShare;

  if (!isIncrease) {
    if (userShare >= numOrders) {
      pending = userShare * accRewardPerShare - rewardDebt;
      // decrease before reward debt calc
      userShare -= numOrders;
    }
    if (saleFees >= fees) {
      salePending = saleFees * accSaleRewardPerShare - saleRewardDebt;
      saleFees -= fees;
    }
    if (buyFees >= fees) {
      buyPending = buyFees * accBuyRewardPerShare - buyRewardDebt;
      buyFees -= fees;
    }
  } else {
    if (userShare > 0) {
      pending = userShare * accRewardPerShare - rewardDebt;
    }
    if (saleFees > 0) {
      salePending = saleFees * accSaleRewardPerShare - saleRewardDebt;
    }
    if (buyFees > 0) {
      buyPending = buyFees * accBuyRewardPerShare - buyRewardDebt;
    }
    // increase before reward debt calc
    userShare += numOrders;
    saleFees += fees;
    buyFees += fees;
  }
  userInfo.rewardsInfo.rewardDebt = userShare * accRewardPerShare;
  userInfo.rewardsInfo.pending = pending;
  userInfo.rewardsInfo.saleRewardDebt = saleFees * accSaleRewardPerShare;
  userInfo.rewardsInfo.salePending = salePending;
  userInfo.rewardsInfo.buyRewardDebt = buyFees * accBuyRewardPerShare;
  userInfo.rewardsInfo.buyPending = buyPending;

  if (hasBonus) {
    if (!isIncrease) {
      if (userBonusShare >= numOrders) {
        bonusPending = userBonusShare * accBonusRewardPerShare - bonusRewardDebt;
        // decrease userShare before rewardDebt calc
        userBonusShare -= numOrders;
      }
    } else {
      if (userBonusShare > 0) {
        bonusPending = userBonusShare * accBonusRewardPerShare - bonusRewardDebt;
      }
      // add current value before reward debt calc
      userBonusShare += numOrders;
    }
    userInfo.rewardsInfo.bonusRewardDebt = userBonusShare * accBonusRewardPerShare;
    userInfo.rewardsInfo.bonusPending = bonusPending;
  }

  // update local info
  localInfo.rewardsInfo.totalRewardPaid += pending;
  localInfo.rewardsInfo.totalBonusRewardPaid += bonusPending;
  localInfo.rewardsInfo.totalSaleRewardPaid += salePending;
  localInfo.rewardsInfo.totalBuyRewardPaid += buyPending;

  return userInfo.rewardsInfo;
}

// updates lastRewardBlock, accRewardPerShare, accBonusRewardPerShare
async function updateLocalRewards() {
  utils.log('Updating local rewards');
  const currentBlock = await getCurrentBlock();
  const totalOrders = globalInfo.totalListings + globalInfo.totalOffers;
  const totalBonusOrders = globalInfo.totalBonusListings + globalInfo.totalBonusOffers;
  const totalFees = globalInfo.totalFees;
  const rewardPerBlock = globalInfo.rewardsInfo.rewardPerBlock;
  const bonusRewardPerBlock = globalInfo.rewardsInfo.bonusRewardPerBlock;
  const saleRewardPerBlock = globalInfo.rewardsInfo.saleRewardPerBlock;
  const buyRewardPerBlock = globalInfo.rewardsInfo.buyRewardPerBlock;

  let lastRewardBlock = localInfo.rewardsInfo.lastRewardBlock;

  if (currentBlock <= lastRewardBlock) {
    utils.log('Not updating global rewards since current block <= lastRewardBlock');
    return false;
  }
  if (totalOrders == 0) {
    utils.log('Not updating global rewards since total liquidity is 0');
    return false;
  }
  const multiplier = currentBlock - lastRewardBlock;
  const reward = multiplier * rewardPerBlock;
  localInfo.rewardsInfo.accRewardPerShare += reward / totalOrders;
  if (totalBonusOrders > 0) {
    const bonusReward = multiplier * bonusRewardPerBlock;
    localInfo.rewardsInfo.accBonusRewardPerShare += bonusReward / totalBonusOrders;
  }
  if (totalFees > 0) {
    const saleReward = multiplier * saleRewardPerBlock;
    localInfo.rewardsInfo.accSaleRewardPerShare += saleReward / totalFees;
    const buyReward = multiplier * buyRewardPerBlock;
    localInfo.rewardsInfo.accBuyRewardPerShare += buyReward / totalFees;
  }

  localInfo.rewardsInfo.lastRewardBlock = currentBlock;

  return true;
}

async function getCurrentBlock() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);
  const currentBlock = await provider.getBlockNumber();
  utils.log('Current eth block: ' + currentBlock);
  return currentBlock;
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
  const totalListings = globalInfo.totalListings;
  const totalBonusListings = globalInfo.totalBonusListings;
  const totalFees = globalInfo.totalFees;
  const totalVolume = globalInfo.totalVolume;

  const penaltyActivated = globalInfo.rewardsInfo.penaltyActivated;
  const penaltyRatio = globalInfo.rewardsInfo.penaltyRatio;
  const rewardPerBlock = globalInfo.rewardsInfo.rewardPerBlock;
  const bonusRewardPerBlock = globalInfo.rewardsInfo.bonusRewardPerBlock;
  const saleRewardPerBlock = globalInfo.rewardsInfo.saleRewardPerBlock;
  const buyRewardPerBlock = globalInfo.rewardsInfo.buyRewardPerBlock;

  const lastRewardBlock = localInfo.rewardsInfo.lastRewardBlock;
  let _accRewardPerShare = localInfo.rewardsInfo.accRewardPerShare;
  let _accBonusRewardPerShare = localInfo.rewardsInfo.accBonusRewardPerShare;
  let _accSaleRewardPerShare = localInfo.rewardsInfo.accSaleRewardPerShare;
  let _accBuyRewardPerShare = localInfo.rewardsInfo.accBuyRewardPerShare;

  const numBought = userInfo.numBought;
  const numSold = userInfo.numSold;
  const numOrders = userInfo.numListings + userInfo.numOffers;
  const numBonusOrders = userInfo.numBonusListings + userInfo.numBonusOffers;
  const saleFees = userInfo.saleFees;
  const buyFees = userInfo.buyFees;
  const rewardDebt = userInfo.rewardsInfo.rewardDebt;
  const bonusRewardDebt = userInfo.rewardsInfo.bonusRewardDebt;
  const saleRewardDebt = userInfo.rewardsInfo.saleRewardDebt;
  const buyRewardDebt = userInfo.rewardsInfo.buyRewardDebt;
  const pending = userInfo.rewardsInfo.pending;
  const bonusPending = userInfo.rewardsInfo.bonusPending;
  const salePending = userInfo.rewardsInfo.salePending;
  const buyPending = userInfo.rewardsInfo.buyPending;

  if (currentBlock > lastRewardBlock && totalListings != 0) {
    const multiplier = currentBlock - lastRewardBlock;
    const reward = multiplier * rewardPerBlock;
    _accRewardPerShare += reward / totalListings;
  }
  if (currentBlock > lastRewardBlock && totalBonusListings != 0) {
    const multiplier = currentBlock - lastRewardBlock;
    const reward = multiplier * bonusRewardPerBlock;
    _accBonusRewardPerShare += reward / totalBonusListings;
  }
  if (currentBlock > lastRewardBlock && totalFees != 0) {
    const multiplier = currentBlock - lastRewardBlock;
    const saleReward = multiplier * saleRewardPerBlock;
    const buyReward = multiplier * buyRewardPerBlock;
    _accSaleRewardPerShare += saleReward / totalFees;
    _accBuyRewardPerShare += buyReward / totalFees;
  }

  const ordersReward = numOrders * _accRewardPerShare - rewardDebt;
  const bonusReward = numBonusOrders * _accBonusRewardPerShare - bonusRewardDebt;
  const saleReward = saleFees * _accSaleRewardPerShare - saleRewardDebt;
  const buyReward = buyFees * _accBuyRewardPerShare - buyRewardDebt;

  const grossReward =
    ordersReward + bonusReward + saleReward + buyReward + pending + bonusPending + salePending + buyPending;

  const resp = {
    currentBlock,
    totalListings,
    totalBonusListings,
    totalFees,
    totalVolume,
    ordersReward,
    bonusReward,
    saleReward,
    buyReward,
    grossReward,
    penaltyActivated,
    penaltyRatio,
    rewardPerBlock,
    bonusRewardPerBlock,
    saleRewardPerBlock,
    buyRewardPerBlock,
    numSold,
    numBought,
    saleFees,
    buyFees,
    numListings: userInfo.numListings,
    numBonusListings: userInfo.numBonusListings,
    numOffers: userInfo.numOffers,
    numBonusOffers: userInfo.numBonusOffers
  };

  let netReward = 0;
  if (penaltyActivated) {
    const salesRatio = numSold / (numOrders + numBonusOrders);
    const penalty = (penaltyRatio - salesRatio) * grossReward;
    // the edge case where all orders are fulfilled
    if (penalty < 0) {
      penalty = 0;
    }
    netReward = grossReward - penalty;
    resp.penalty = penalty;
    resp.netReward = netReward;
  } else {
    resp.penalty = 0;
    resp.netReward = grossReward;
  }

  // write net reward to firestore async for leader board purpose
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .update({
      'rewardsInfo.netReward': netReward,
      'rewardsInfo.netRewardCalculatedAt': Date.now()
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
