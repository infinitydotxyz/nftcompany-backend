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

// ============================================== Global data handling ======================================================
let globalInfo;
let localInfo = getEmptyGlobalInfo();
db.collection(fstrCnstnts.ROOT_COLL)
  .doc(fstrCnstnts.INFO_DOC)
  .get(
    (doc) => {
      globalInfo = { ...getEmptyGlobalInfo(), ...doc.data() };
      globalInfo.rewardsInfo = {
        ...getEmptyGlobalInfo().rewardsInfo,
        ...doc.data().rewardsInfo
      };
    },
    (err) => {
      utils.error('Encountered error while getting global info. Exiting process');
      utils.error(err);
      process.exit();
    }
  );

// write to firestore every interval
setInterval(() => {
  // make a copy of localinfo
  const updateData = JSON.parse(JSON.stringify(localInfo));
  const ref = db.collection(fstrCnstnts.ROOT_COLL).doc(fstrCnstnts.INFO_DOC);
  db.runTransaction(async (txn) => {
    const globalDoc = await txn.get(ref);
    // reconcile globalinfo
    reconcileGlobalInfo(globalDoc.data(), updateData);
    txn.update(ref, globalInfo);
  })
    .then((res) => {
      // reconcile localinfo
      reconcileLocalInfo(updateData);
    })
    .catch((err) => {
      utils.error('Failed updating global info in firestore', err);
      utils.error(err);
    });
}, 1000 * 10); // every 10 seconds

function reconcileGlobalInfo(globalData, updateData) {
  globalInfo = { ...getEmptyGlobalInfo(), ...globalData };
  globalInfo.rewardsInfo = {
    ...getEmptyGlobalInfo().rewardsInfo,
    ...globalData.rewardsInfo
  };

  globalInfo.totalSales += updateData.totalSales;
  globalInfo.totalFees += updateData.totalFees;
  globalInfo.totalVolume += updateData.totalVolume;
  globalInfo.totalListings += updateData.totalListings;
  globalInfo.totalBonusListings += updateData.totalBonusListings;
  globalInfo.totalOffers += updateData.totalOffers;
  globalInfo.totalBonusOffers += updateData.totalBonusOffers;

  globalInfo.rewardsInfo.accRewardPerShare += updateData.rewardsInfo.accRewardPerShare;
  globalInfo.rewardsInfo.accBonusRewardPerShare += updateData.rewardsInfo.accBonusRewardPerShare;
  globalInfo.rewardsInfo.accSaleRewardPerShare += updateData.rewardsInfo.accSaleRewardPerShare;
  globalInfo.rewardsInfo.accBuyRewardPerShare += updateData.rewardsInfo.accBuyRewardPerShare;
  globalInfo.rewardsInfo.totalRewardPaid += updateData.rewardsInfo.totalRewardPaid;
  globalInfo.rewardsInfo.totalBonusRewardPaid += updateData.rewardsInfo.totalBonusRewardPaid;
  globalInfo.rewardsInfo.totalSaleRewardPaid += updateData.rewardsInfo.totalSaleRewardPaid;
  globalInfo.rewardsInfo.totalBuyRewardPaid += updateData.rewardsInfo.totalBuyRewardPaid;

  if (globalInfo.rewardsInfo.lastRewardBlock < updateData.rewardsInfo.lastRewardBlock) {
    globalInfo.rewardsInfo.lastRewardBlock = updateData.rewardsInfo.lastRewardBlock;
  }
}

function reconcileLocalInfo(updateData) {
  localInfo.totalSales -= updateData.totalSales;
  localInfo.totalFees -= updateData.totalFees;
  localInfo.totalVolume -= updateData.totalVolume;
  localInfo.totalListings -= updateData.totalListings;
  localInfo.totalBonusListings -= updateData.totalBonusListings;
  localInfo.totalOffers -= updateData.totalOffers;
  localInfo.totalBonusOffers -= updateData.totalBonusOffers;

  localInfo.rewardsInfo.accRewardPerShare -= updateData.rewardsInfo.accRewardPerShare;
  localInfo.rewardsInfo.accBonusRewardPerShare -= updateData.rewardsInfo.accBonusRewardPerShare;
  localInfo.rewardsInfo.accSaleRewardPerShare -= updateData.rewardsInfo.accSaleRewardPerShare;
  localInfo.rewardsInfo.accBuyRewardPerShare -= updateData.rewardsInfo.accBuyRewardPerShare;
  localInfo.rewardsInfo.totalRewardPaid -= updateData.rewardsInfo.totalRewardPaid;
  localInfo.rewardsInfo.totalBonusRewardPaid -= updateData.rewardsInfo.totalBonusRewardPaid;
  localInfo.rewardsInfo.totalSaleRewardPaid -= updateData.rewardsInfo.totalSaleRewardPaid;
  localInfo.rewardsInfo.totalBuyRewardPaid -= updateData.rewardsInfo.totalBuyRewardPaid;
}

// =========================================== Server ===========================================================

// Listen to the App Engine-specified port, or 9090 otherwise
const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
  utils.log(`Server listening on port ${PORT}...`);
});

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

// fetch all listings
app.get('/listings', async (req, res) => {
  const price = req.query.price || '5000'; // add a default max of 5000 eth
  const sortByPrice = req.query.sortByPrice || 'asc'; // ascending default
  db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where('metadata.basePriceInEth', '<=', +price)
    .orderBy('metadata.basePriceInEth', sortByPrice)
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

// fetch assets of user
app.get('/u/:user/assets', async (req, res) => {
  const user = req.params.user.trim().toLowerCase();
  const limit = req.query.limit;
  const offset = req.query.offset;
  const source = req.query.source;
  const sourceName = nftDataSources[source];
  try {
    let resp = await getAssets(user, limit, offset, sourceName);
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

//fetch listings of user
app.get('/u/:user/listings', async (req, res) => {
  const user = req.params.user.trim().toLowerCase();

  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
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

//fetch offer made by user
app.get('/u/:user/offersmade', async (req, res) => {
  const user = req.params.user.trim().toLowerCase();

  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.OFFERS_MADE_COLL)
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

  db.collectionGroup(fstrCnstnts.OFFERS_MADE_COLL)
    .where('metadata.asset.owner', '==', user)
    .orderBy('metadata.basePriceInEth', sortByPrice)
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
  const startsWith = req.query.startsWith;
  if (typeof startsWith === 'string') {
    const endCode = utils.getEndCode(startsWith);
    db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.title', '>=', startsWith)
      .where('metadata.asset.title', '<', endCode)
      .select('metadata.asset.title', 'metadata.asset.id')
      .limit(10)
      .get()
      .then((data) => {
        // to enable cdn cache
        let resp = data.docs.map((doc) => {
          return {
            title: doc.data().metadata.asset.title,
            id: doc.data().metadata.asset.id
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
  const address = req.query.id;
  db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where('metadata.asset.id', '==', address)
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
      utils.error('Failed to get listing by address', err);
      res.sendStatus(500);
    });
});
app.get('/collections', async (req, res) => {
  const startsWith = req.query.startsWith;
  if (typeof startsWith === 'string') {
    const endCode = utils.getEndCode(startsWith);
    db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.collectionName', '>=', startsWith)
      .where('metadata.asset.collectionName', '<', endCode)
      .orderBy('metadata.asset.collectionName')
      .select('metadata.asset.collectionName', 'metadata.asset.address')
      .limit(10)
      .get()
      .then((data) => {
        // to enable cdn cache
        let resp = data.docs.map((doc) => {
          return doc.data().metadata.asset.collectionName;
        });
        // remove duplicates and take only the first 10 results
        resp = [...new Set(resp)].slice(0, 10);
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
  const sortByPrice = req.query.sortByPrice || 'asc'; // ascending default
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
  const tokenId = payload.metadata.asset.id;
  const id = getDocId(tokenAddress, tokenId);
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
      await postListing(id, maker, payload, batch, numOrders, hasBonus);
    } else if (payload.side == 0) {
      // offer
      await postOffer(id, maker, payload, batch, numOrders, hasBonus);
    } else {
      utils.error('Unknown order type');
      return;
    }

    // commit batch
    utils.log('Posting an order with id ' + id);
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

// order fulfilled
app.post('/u/:user/wyvern/v1/orders/fulfilled', async (req, res) => {
  // user is the taker of the order - either bought now or accepted offer
  // write to bought and sold and delete from listing, offer made, offer recvd
  /* cases in which order is fulfilled:
    1) listed an item and a buy now is made on it; order is the listing
    2) listed an item, offer received on it, offer is accepted; order is the offerReceived
    3) no listing made, but offer is received on it, offer is accepted; order is the offerReceived
  */
  try {
    const order = req.body;
    const taker = req.params.user.trim().toLowerCase();
    const maker = order.maker.trim().toLowerCase();
    const side = +order.side;
    const offerMadeOnListing = order.metadata.offerMadeOnListing;
    const tokenAddress = order.metadata.asset.address.trim().toLowerCase();
    const tokenId = order.metadata.asset.id;
    const docId = getDocId(tokenAddress, tokenId);
    const numOrders = 1;
    const feesInEth = +order.metadata.feesInEth;
    const salePriceInEth = +order.metadata.salePriceInEth;
    const batch = db.batch();
    order.taker = taker;

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
        .collection(fstrCnstnts.OFFERS_MADE_COLL)
        .doc(docId)
        .get();
      if (!doc.exists) {
        utils.log('No order ' + docId + ' to fulfill');
        res.sendStatus(404);
        return;
      }

      utils.log('Item bought by ' + maker + ' sold by ' + taker);

      // write to bought by maker; multiple items possible
      await saveBoughtOrder(docId, maker, order, batch, numOrders);

      // write to sold by taker; multiple items possible
      await saveSoldOrder(docId, taker, order, batch, numOrders);

      // delete offerMade by maker
      deleteOfferMadeWithId(docId, maker);

      // delete listing by taker if it exists
      if (offerMadeOnListing) {
        deleteListingWithId(docId, taker);
      }

      // send email to maker that the offer is accepted
      prepareEmail(maker, order, 'offerAccepted');
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

      utils.log('Item bought by ' + taker + ' sold by ' + maker);

      // write to bought by taker; multiple items possible
      await saveBoughtOrder(docId, taker, order, batch, numOrders);

      // write to sold by maker; multiple items possible
      await saveSoldOrder(docId, maker, order, batch, numOrders);

      // delete listing from maker
      deleteListingWithId(docId, maker);

      // send email to maker that the listing is bought
      prepareEmail(maker, order, 'listingBought');
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
    const listing = req.params.listing.trim().toLowerCase();

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

    deleteListing(doc);
    res.sendStatus(200);
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
    const offer = req.params.offer.trim().toLowerCase();

    // check if offer exists first
    const offerRef = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.OFFERS_MADE_COLL)
      .doc(offer);
    const doc = await offerRef.get();
    if (!doc.exists) {
      utils.log('No offer ' + offer + ' to delete');
      res.sendStatus(404);
      return;
    }

    deleteOffer(doc);
    res.sendStatus(200);
  } catch (err) {
    utils.error(err);
    res.sendStatus(500);
  }
});

// ====================================================== Write helpers ==========================================================

async function saveBoughtOrder(docId, user, order, batch, numOrders) {
  // save order
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.BOUGHT_COLL)
    .doc(docId)
    .collection(fstrCnstnts.BOUGHT_COLL)
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

async function saveSoldOrder(docId, user, order, batch, numOrders) {
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.SOLD_COLL)
    .doc(docId)
    .collection(fstrCnstnts.SOLD_COLL)
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

async function postListing(id, maker, payload, batch, numOrders, hasBonus) {
  // check if token is verified if payload instructs so
  let blueCheck = payload.metadata.hasBlueCheck;
  if (payload.metadata.checkBlueCheck) {
    blueCheck = await isTokenVerified(tokenAddress);
  }
  payload.metadata.hasBlueCheck = blueCheck;

  // write listing
  const listingRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc(id);
  batch.set(listingRef, payload, { merge: true });

  // check if doc already exists (in case of edit listing) - only update numlistings if it isn't
  const listing = await listingRef.get();
  if (!listing.exists) {
    utils.log('updating num listings since listing does not exist');
    // update num user listings
    updateNumOrders(batch, maker, numOrders, hasBonus, 1);
    // update total listings
    updateNumTotalOrders(numOrders, hasBonus, 1);
  }
}

async function postOffer(id, maker, payload, batch, numOrders, hasBonus) {
  const taker = payload.metadata.asset.owner.trim().toLowerCase();
  // store data in offersMade of maker
  const offersMadeRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.OFFERS_MADE_COLL)
    .doc(id);
  batch.set(offersMadeRef, payload, { merge: true });

  // check if doc already exists (in case of edit offer) - only update numOffers if it isn't
  const offer = await offersMadeRef.get();
  if (!offer.exists) {
    utils.log('updating num offers since offer does not exist');
    // update num user offers made
    updateNumOrders(batch, maker, numOrders, hasBonus, 0);
    // update total offers made
    updateNumTotalOrders(numOrders, hasBonus, 0);
  }

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
    collection = fstrCnstnts.OFFERS_MADE_COLL;
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
  batch.set(ref, { rewardsInfo: data }, { merge: true });
}

// ==================================================== Get assets ==========================================================

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

function getDocId(tokenAddress, tokenId) {
  const data = tokenAddress + tokenId;
  const id = crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  return id;
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
  if (side == 1) {
    // listing
    deleteListing(doc);
  } else if (side == 0) {
    // offer
    deleteOffer(doc);
  } else {
    utils.error('Unknown order type', doc.id);
  }
}

function deleteListingWithId(id, user) {
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc(id)
    .get()
    .then((listingDoc) => {
      deleteListing(listingDoc);
    })
    .catch((err) => {
      utils.error('cannot delete listing');
      utils.error(err);
    });
}

async function deleteListing(doc) {
  const listing = doc.id;
  utils.log('Deleting listing', listing);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;
  const batch = db.batch();

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

  // Commit the batch
  batch
    .commit()
    .then((resp) => {})
    .catch((err) => {
      utils.error('Failed to delete listing ' + listing);
      utils.error(err);
    });
}

function deleteOfferMadeWithId(id, user) {
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.OFFERS_MADE_COLL)
    .doc(id)
    .get()
    .then((offerMadeDoc) => {
      deleteOffer(offerMadeDoc);
    })
    .catch((err) => {
      utils.error('cannot delete offer');
      utils.error(err);
    });
}

async function deleteOffer(doc) {
  const offer = doc.id;
  utils.log('Deleting offer', offer);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;
  const batch = db.batch();

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

  // Commit the batch
  batch
    .commit()
    .then((resp) => {})
    .catch((err) => {
      utils.error('Failed to delete offer ' + offer);
      utils.error(err);
    });
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
      penaltyActivated: 0,
      penaltyRatio: 0
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
    numSales: 0,
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
  const totalBonusOrders = globalInfo.totalBonusListings + globalInfo.totalBonusOrders;
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
    const salesRatio = numSales / (numOrders + numBonusOrders);
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
      'rewardsInfo.netRewardCalculatedAt': firebaseAdmin.firestore.FieldValue.serverTimestamp()
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
            verified: true
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
