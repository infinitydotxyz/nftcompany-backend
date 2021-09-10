require("dotenv").config();
const { ethers } = require("ethers");
const express = require("express");
const axios = require("axios").default;
const crypto = require("crypto");
const app = express();
const cors = require("cors");
app.use(express.json());
app.use(cors());

const utils = require("./utils");
const constants = require("./constants");
const fstrCnstnts = constants.firestore;

const firebaseAdmin = utils.getFirebaseAdmin();
const db = firebaseAdmin.firestore();

const nftDataSources = {
  0: "nftc",
  1: "opensea",
  2: "unmarshal",
  3: "alchemy",
};

// ============================================== Global data handling ======================================================
let globalInfo;
let localInfo = getEmptyGlobalInfo();
db.collection(fstrCnstnts.ROOT_COLL)
  .doc(fstrCnstnts.INFO_DOC)
  .get(doc => {
    globalInfo = { ...getEmptyGlobalInfo(), ...doc.data() };
    globalInfo.rewardsInfo = { ...getEmptyGlobalInfo().rewardsInfo, ...doc.data().rewardsInfo };
  },
  (err) => {
    utils.error('Encountered error while getting global info. Exiting process', err);
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
  }).then(res => {
    utils.log("Updated global info in firestore");
    // reconcile localinfo
    reconcileLocalInfo(updateData);
  }).catch(error => {
    utils.error("Failed updating global info in firestore", error);
  });
}, 1000 * 10); // every 10 seconds

function reconcileGlobalInfo(globalData, updateData) {
  globalInfo = { ...getEmptyGlobalInfo(), ...globalData };
  globalInfo.rewardsInfo = {
    ...getEmptyGlobalInfo().rewardsInfo,
    ...globalData.rewardsInfo,
  };

  globalInfo.totalSales += updateData.totalSales;
  globalInfo.totalFees += updateData.totalFees;
  globalInfo.totalListings += updateData.totalListings;
  globalInfo.totalBonusListings += updateData.totalBonusListings;
  globalInfo.totalOffers += updateData.totalOffers;
  globalInfo.totalBonusOffers += updateData.totalBonusOffers;

  globalInfo.rewardsInfo.accRewardPerShare += updateData.rewardsInfo.accRewardPerShare;
  globalInfo.rewardsInfo.accBonusRewardPerShare += updateData.rewardsInfo.accBonusRewardPerShare;
  globalInfo.rewardsInfo.accFeeRewardPerShare += updateData.rewardsInfo.accFeeRewardPerShare;
  globalInfo.rewardsInfo.totalRewardPaid += updateData.rewardsInfo.totalRewardPaid;
  globalInfo.rewardsInfo.totalBonusRewardPaid += updateData.rewardsInfo.totalBonusRewardPaid;
  globalInfo.rewardsInfo.totalFeeRewardPaid += updateData.rewardsInfo.totalFeeRewardPaid;

  if (globalInfo.rewardsInfo.lastRewardBlock < updateData.rewardsInfo.lastRewardBlock) {
    globalInfo.rewardsInfo.lastRewardBlock = updateData.rewardsInfo.lastRewardBlock;
  }
}

function reconcileLocalInfo(updateData) {
  localInfo.totalSales -= updateData.totalSales;
  localInfo.totalFees -= updateData.totalFees;
  localInfo.totalListings -= updateData.totalListings;
  localInfo.totalBonusListings -= updateData.totalBonusListings;
  localInfo.totalOffers -= updateData.totalOffers;
  localInfo.totalBonusOffers -= updateData.totalBonusOffers;

  localInfo.rewardsInfo.accRewardPerShare -= updateData.rewardsInfo.accRewardPerShare;
  localInfo.rewardsInfo.accBonusRewardPerShare -= updateData.rewardsInfo.accBonusRewardPerShare;
  localInfo.rewardsInfo.accFeeRewardPerShare -= updateData.rewardsInfo.accFeeRewardPerShare;
  localInfo.rewardsInfo.totalRewardPaid -= updateData.rewardsInfo.totalRewardPaid;
  localInfo.rewardsInfo.totalBonusRewardPaid -= updateData.rewardsInfo.totalBonusRewardPaid;
  localInfo.rewardsInfo.totalFeeRewardPaid -= updateData.rewardsInfo.totalFeeRewardPaid;
}

// =========================================== Server ===========================================================

// Listen to the App Engine-specified port, or 9090 otherwise
const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
  utils.log(`Server listening on port ${PORT}...`);
});

app.all("/u/*", async (req, res, next) => {
  let authorized = await utils.authorizeUser(
    req.path,
    req.header(constants.auth.signature),
    req.header(constants.auth.message)
  );
  if (authorized) {
    next();
  } else {
    res.status(401).send("Unauthorized");
  }
});

// ================================================ READ ===================================================================

// check if token is verified or has bonus reward
app.get("/token/:tokenAddress/verfiedBonusReward", async (req, res) => {
  const tokenAddress = req.params.tokenAddress.trim().toLowerCase();
  const verified = await isTokenVerified(tokenAddress);
  const bonusReward = await hasBonusReward(tokenAddress);
  let resp = {
    verified,
    bonusReward,
  };
  resp = utils.jsonString(resp);
  // to enable cdn cache
  res.set({
    "Cache-Control": "must-revalidate, max-age=3600",
    "Content-Length": Buffer.byteLength(resp, "utf8"),
  });
  res.send(resp);
});

// fetch all listings
app.get("/listings", async (req, res) => {
  const price = req.query.price || "5000"; // add a default max of 5000 eth
  const sortByPrice = req.query.sortByPrice || "asc"; // ascending default
  db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where("metadata.basePriceInEth", "<=", +price)
    .orderBy("metadata.basePriceInEth", sortByPrice)
    .get()
    .then((querySnapshot) => {
      const data = querySnapshot.docs.map((doc) => doc.data());
      res.send(data);
    })
    .catch((err) => {
      utils.error("Failed to get listings", err);
      res.sendStatus(500);
    });
});

// fetch assets of user
app.get("/u/:user/assets", async (req, res) => {
  const user = req.params.user.trim().toLowerCase();
  const limit = req.query.limit;
  const offset = req.query.offset;
  const source = req.query.source;
  const sourceName = nftDataSources[source];
  let resp = await getAssets(user, limit, offset, sourceName);
  resp = utils.jsonString(resp);
  // to enable cdn cache
  res.set({
    "Cache-Control": "must-revalidate, max-age=300",
    "Content-Length": Buffer.byteLength(resp, "utf8"),
  });
  res.send(resp);
});

//fetch listings of user
app.get("/u/:user/listings", async (req, res) => {
  const user = req.params.user.trim().toLowerCase();

  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .get()
    .then((data) => {
      let listings = [];
      for (const doc of data.docs) {
        const listing = doc.data();
        listing.id = doc.id;
        listings.push(listing);
      }
      const resp = {
        count: listings.length,
        listings: listings,
      };
      res.send(resp);
    })
    .catch((err) => {
      utils.error("Failed to get user listings for user " + user, err);
      res.sendStatus(500);
    });
});

// fetch order to fulfill
app.get("/wyvern/v1/orders", async (req, res) => {
  const maker = req.query.maker.trim().toLowerCase();
  const tokenAddress = req.query.assetContractAddress.trim().toLowerCase();
  const tokenId = req.query.tokenId;
  const side = req.query.side;

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
      orders: orders,
    };
    res.send(resp);
  } else {
    res.sendStatus(404);
  }
});

// fetch user reward
app.get("/u/:user/reward", async (req, res) => {
  const user = req.params.user.trim().toLowerCase();
  let resp = await getReward(user);
  resp = utils.jsonString(resp);
  // to enable cdn cache
  res.set({
    "Cache-Control": "must-revalidate, max-age=300",
    "Content-Length": Buffer.byteLength(resp, "utf8"),
  });
  res.send(resp);
});

//fetch rewards leaderboard
app.get("/rewards/leaderboard", async (req, res) => {
  db.collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .orderBy("rewardsInfo.netReward", "desc")
    .limit(10)
    .get()
    .then((data) => {
      let results = [];
      for (const doc of data.docs) {
        results.push(doc.data());
      }
      let resp = {
        count: results.length,
        results: results,
      };
      resp = utils.jsonString(resp);
      // to enable cdn cache
      res.set({
        "Cache-Control": "must-revalidate, max-age=600",
        "Content-Length": Buffer.byteLength(resp, "utf8"),
      });
      res.send(resp);
    })
    .catch((err) => {
      utils.error("Failed to get leaderboard", err);
      res.sendStatus(500);
    });
});

app.get("/titles", async (req, res) => {
  const startsWith = req.query.startsWith;
  if (typeof startsWith === "string") {
    const endCode = utils.getEndCode(startsWith);
    db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where("metadata.asset.title", ">=", startsWith)
      .where("metadata.asset.title", "<", endCode)
      .limit(10)
      .get()
      .then((data) => {
        // to enable cdn cache
        const resp = utils.jsonString(data.docs);
        res.set({
          "Cache-Control": "must-revalidate, max-age=600",
          "Content-Length": Buffer.byteLength(resp, "utf8"),
        });
        res.send(resp);
      });
  } else {
    res.send([]);
  }
});

app.get("/collections", async (req, res) => {
  const startsWith = req.query.startsWith;
  if (typeof startsWith === "string") {
    const endCode = utils.getEndCode(startsWith);
    db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where("metadata.asset.collectionName", ">=", startsWith)
      .where("metadata.asset.collectionName", "<", endCode)
      .limit(10)
      .get()
      .then((data) => {
        // to enable cdn cache
        const resp = utils.jsonString(data.docs);
        res.set({
          "Cache-Control": "must-revalidate, max-age=600",
          "Content-Length": Buffer.byteLength(resp, "utf8"),
        });
        res.send(resp);
      });
  } else {
    res.send([]);
  }
});

//=============================================== WRITES =====================================================================

// post a listing or make offer
app.post("/u/:user/wyvern/v1/orders", async (req, res) => {
  const payload = req.body;
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  const tokenId = payload.metadata.asset.id;
  const id = getDocId(tokenAddress, tokenId);
  const maker = req.params.user.trim().toLowerCase();
  // default one order per post call
  const numOrders = 1;
  const batch = db.batch();

  // check if token has bonus if payload instructs so
  let hasBonus = payload.metadata.hasBonusReward;
  if (payload.metadata.checkBonusReward) {
    hasBonus = await hasBonusReward(tokenAddress);
  }
  payload.metadata.hasBonusReward = hasBonus;

  // update rewards
  const updatedRewards = await getUpdatedRewards(
    maker,
    hasBonus,
    numOrders,
    true
  );

  if (updatedRewards) {
    // update user rewards data
    storeUpdatedUserRewards(batch, maker, updatedRewards);
  } else {
    utils.log("Not updating rewards data as there are no updates");
  }

  if (payload.side == 1) { // listing
    postListing(id, maker, payload, batch, hasBonus);
  } else if (payload.side == 0) { // offer
    postOffer(id, maker, payload, batch, hasBonus);
  } else {
    utils.error('Unknown order type');
    return
  }

  // commit batch
  utils.log("Posting an order with id " + id);
  batch
    .commit()
    .then((resp) => {
      res.send(payload);
    })
    .catch((err) => {
      utils.error("Failed to post order", err);
      res.sendStatus(500);
    });
});

// cancel listing
app.delete("/u/:user/listings/:listing", async (req, res) => {
  // delete listing and any offers recvd
  const user = req.params.user.trim().toLowerCase();
  const listing = req.params.listing.trim().toLowerCase();
  const numOrders = 1;

  // check if listing exists first
  const listingRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc(listing);
  const listingDoc = await listingRef.get();
  if (!listingDoc.exists) {
    utils.log("No listing " + listing + " to delete");
    return;
  }

  const hasBonus = listingDoc.data().metadata.hasBonusReward
  const batch = db.batch();

  const updatedRewards = await getUpdatedRewards(
    user,
    hasBonus,
    numOrders,
    false
  );

  if (updatedRewards) {
    // update user rewards data
    storeUpdatedUserRewards(batch, user, updatedRewards);
  } else {
    utils.log("Not updating rewards data as there are no updates");
  }

  // delete listing
  batch.delete(listingRef);

  // multiple offers can be received on the same nft
  const offersRecdRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.OFFERS_RECVD_COLL)
    .doc(listing);
  batch.delete(offersRecdRef);

  // deleting a doc doesn't delete a sub collection, we have to do it separately
  const subCollPath =
    fstrCnstnts.ROOT_COLL +
    "/" +
    fstrCnstnts.INFO_DOC +
    "/" +
    fstrCnstnts.USERS_COLL +
    "/" +
    user +
    "/" +
    fstrCnstnts.OFFERS_RECVD_COLL +
    "/" +
    listing +
    "/" +
    fstrCnstnts.OFFERS_RECVD_COLL;
  try {
    // delete in a batch size of 1000
    deleteCollection(subCollPath, 1000);
  } catch (error) {
    utils.error(
      "Error deleting offers received sub collection for listing " + listing,
      error
    );
  }

  // update num user listings
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 1);

  // update total listings
  updateNumTotalOrders(-1 * numOrders, hasBonus, 1);

  // Commit the batch
  utils.log("Deleting a listing with id " + listing);
  batch
    .commit()
    .then((resp) => {
      res.sendStatus(200);
    })
    .catch((err) => {
      utils.error("Failed to delete listing " + listing, err);
      res.sendStatus(500);
    });
});

// order fulfilled
app.post("/u/:user/wyvern/v1/orders/fulfilled", (req, res) => {
  // write to bought and sold and delete from listing, offer made, offer recvd
});

// ====================================================== HELPERS ==========================================================

async function postListing(id, maker, payload, batch, hasBonus) {
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
    utils.log("updating num listings since listing does not exist");
    // update num user listings
    updateNumOrders(batch, maker, numOrders, hasBonus, 1);
    // update total listings
    updateNumTotalOrders(numOrders, hasBonus, 1);
  }
}

async function postOffer(payload, maker, batch, hasBonus) {
  const taker = payload.taker.trim().toLowerCase();
  // store data in offersMade of maker and offersRecd of taker
  const offersMadeRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.OFFERS_MADE_COLL)
    .doc(id);
  batch.set(offersMadeRef, payload, { merge: true });

  // multiple offers can be received on the same nft
  const offersRecdRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(taker)
    .collection(fstrCnstnts.OFFERS_RECVD_COLL)
    .doc(id)
    .collection(fstrCnstnts.OFFERS_RECVD_COLL)
    .doc();
  batch.set(offersRecdRef, payload, { merge: true });

  // check if doc already exists (in case of edit offer) - only update numOffers if it isn't
  const offer = await offersMadeRef.get();
  if (!offer.exists) {
    utils.log("updating num offers since offer does not exist");
    // update num user offers made
    updateNumOrders(batch, maker, numOrders, hasBonus, 0);
    // update total offers made
    updateNumTotalOrders(numOrders, hasBonus, 0);
  }
}

// ==================================================== Update num orders ===============================================

function updateNumOrders(batch, user, num, hasBonus, side) {
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  if (side == 0) { //offers
    batch.set(
      ref,
      { numOffers: firebaseAdmin.firestore.FieldValue.increment(num) },
      { merge: true }
    );
    if (hasBonus) {
      batch.set(
        ref,
        { numBonusOffers: firebaseAdmin.firestore.FieldValue.increment(num) },
        { merge: true }
      );
    }
  } else if (side == 1) { // listings
    batch.set(
      ref,
      { numListings: firebaseAdmin.firestore.FieldValue.increment(num) },
      { merge: true }
    );
    if (hasBonus) {
      batch.set(
        ref,
        { numBonusListings: firebaseAdmin.firestore.FieldValue.increment(num) },
        { merge: true }
      );
    }
  }
}

// todo: now write
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
  incrementLocalStats({totalOffers, totalBonusOffers, totalListings, totalBonusListings});
}

function incrementLocalStats({
  totalOffers,
  totalBonusOffers,
  totalListings,
  totalBonusListings,
  totalFees,
  totalSales,
}) {
  localInfo.totalOffers += totalOffers || 0;
  localInfo.totalBonusOffers += totalBonusOffers || 0;
  localInfo.totalListings += totalListings || 0;
  localInfo.totalBonusListings += totalBonusListings || 0;
  localInfo.totalFees += totalFees || 0;
  localInfo.totalSales += totalSales || 0;
}

// ================================================== Update rewards =========================================================

function storeUpdatedUserRewards(batch, user, data) {
  const ref = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  batch.set(
    ref,
    { rewardsInfo: data },
    { merge: true }
  );
}

// ==================================================== Get assets ==========================================================

async function getAssets(address, limit, offset, sourceName) {
  utils.log("Fetching assets for", address);
  const results = await getAssetsFromChain(address, limit, offset, sourceName);
  return results;
}

async function getAssetsFromChain(address, limit, offset, sourceName) {
  let data;
  switch (sourceName) {
    case "nftc":
      data = await getAssetsFromNftc(address, limit, offset);
      break;
    case "alchemy":
      data = await getAssetsFromAlchemy(address, limit, offset);
      break;
    case "unmarshal":
      data = await getAssetsFromUnmarshal(address, limit, offset);
      break;
    case "opensea":
      data = await getAssetsFromOpensea(address, limit, offset);
      break;
    default:
      utils.log("Invalid data source for fetching nft data of wallet");
  }
  return data;
}
async function getAssetsFromNftc(address, limit, offset) {
  utils.log("Fetching assets from nftc");
  return;
}

async function getAssetsFromAlchemy(address, limit, offset) {
  utils.log("Fetching assets from alchemy");
  return;
}

async function getAssetsFromUnmarshal(address, limit, offset) {
  utils.log("Fetching assets from unmarshal");
  const apiBase = "https://api.unmarshal.com/v1/";
  const chain = "ethereum";
  const authKey = process.env.unmarshalKey;
  const url =
    apiBase + chain + "/address/" + address + "/nft-assets?auth_key=" + authKey;
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    utils.error("Error occured while fetching assets from unmarshal", error);
    return;
  }
}

async function getAssetsFromOpensea(address, limit, offset) {
  utils.log("Fetching assets from opensea");
  const apiBase = "https://api.opensea.io/api/v1/assets/";
  const authKey = process.env.openseaKey;
  const url =
    apiBase + "?limit=" + limit + "&offset=" + offset + "&owner=" + address;
  const options = {
    headers: {
      "X-API-KEY": authKey,
    },
  };
  try {
    utils.log(url);
    const { data } = await axios.get(url, options);
    return data;
  } catch (error) {
    utils.error("Error occured while fetching assets from opensea", error);
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
  const id = crypto
    .createHash("sha256")
    .update(data)
    .digest("hex")
    .trim()
    .toLowerCase();
  utils.log(
    "Doc id for token address " +
      tokenAddress +
      " and token id " +
      tokenId +
      " is " +
      id
  );
  return id;
}

async function getOrders(maker, tokenAddress, tokenId, side) {
  utils.log("Fetching order for", maker, tokenAddress, tokenId, side);
  const results = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .where("metadata.asset.address", "==", tokenAddress)
    .where("metadata.asset.id", "==", tokenId)
    .where("side", "==", parseInt(side))
    .get();

  if (results.empty) {
    utils.log("No matching orders");
    return;
  }
  return results.docs;
}

async function deleteCollection(collectionPath, batchSize) {
  utils.log("Deleting collection at", collectionPath);
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();
  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }
  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  // Recurse on the next process tick, to avoid exploding the stack
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
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

async function getUpdatedRewards(user, hasBonus, numOrders, isIncrease) {
  utils.log("Getting updated reward for user", user);

  let userInfo = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  userInfo = { ...getEmptyUserInfo(), ...userInfo.data() };
  userInfo.rewardsInfo = {
    ...getEmptyUserRewardInfo(),
    ...userInfo.rewardsInfo,
  };

  let updatedRewards = updateRewards(hasBonus, numOrders, userInfo, isIncrease);
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
    rewardsInfo: {
      accRewardPerShare: 0,
      accBonusRewardPerShare: 0,
      accFeeRewardPerShare: 0,
      rewardPerBlock: 0,
      bonusRewardPerBlock: 0,
      feeRewardPerBlock: 0,
      totalRewardPaid: 0,
      totalBonusRewardPaid: 0,
      totalFeeRewardPaid: 0,
      lastRewardBlock: 0,
      penaltyActivated: 0,
      penaltyRatio: 0,
    },
  };
}

function getEmptyUserInfo() {
  return {
    numListings: 0,
    numBonusListings: 0,
    numOffers: 0,
    numBonusOffers: 0,
    numSales: 0,
    feesPaid: 0,
    ens: "",
    rewardsInfo: getEmptyUserRewardInfo(),
  };
}

function getEmptyUserRewardInfo() {
  return {
    rewardDebt: 0,
    bonusRewardDebt: 0,
    feeRewardDebt: 0,
    pending: 0,
    bonusPending: 0,
    feePending: 0,
    netReward: 0,
    netRewardCalculatedAt: 0,
  };
}

// updates totalRewardPaid, totalBonusRewardPaid and returns user share
async function updateRewards(hasBonus, numOrders, userInfo, isIncrease) {
  utils.log("Updating rewards in increasing mode =", isIncrease);

  let userShare = userInfo.numListings + userInfo.numOffers;
  let rewardDebt = userInfo.rewardsInfo.rewardDebt;
  let pending = 0;
  let bonusPending = 0;

  if (!isIncrease) {
    if (userShare < numOrders) {
      utils.error("Cannot decrease share");
      return;
    }
  }

  const result = await updateLocalRewards(hasBonus);
  if (!result) {
    utils.log("Not adjusting share");
    return;
  }

  const accRewardPerShare = localInfo.rewardsInfo.accRewardPerShare;
  if (isIncrease) {
    if (userShare > 0) {
      pending = userShare * accRewardPerShare - rewardDebt;
    }
    // add current value before reward debt calc
    userShare += numOrders;
  } else {
    pending = userShare * accRewardPerShare - rewardDebt;
    // decrease userShare before rewardDebt calc
    userShare -= numOrders;
  }

  rewardDebt = userShare * accRewardPerShare;
  userInfo.rewardsInfo.rewardDebt = rewardDebt;
  userInfo.rewardsInfo.pending = pending;

  if (hasBonus) {
    let userBonusShare = userInfo.numBonusListings + userInfo.numBonusOffers;
    let bonusRewardDebt = userInfo.rewardsInfo.bonusRewardDebt;
    if (!isIncrease) {
      if (userBonusShare < numOrders) {
        utils.error("Cannot decrease bonus share");
        return;
      }
    }

    const accBonusRewardPerShare = localInfo.rewardsInfo.accBonusRewardPerShare;
    
    let bonusPending = 0;
    if (isIncrease) {
      if (userBonusShare > 0) {
        bonusPending = userBonusShare * accBonusRewardPerShare - bonusRewardDebt;
      }
      // add current value before reward debt calc
      userBonusShare += numOrders;
    } else {
      bonusPending = userBonusShare * accBonusRewardPerShare - bonusRewardDebt;
      // decrease userShare before rewardDebt calc
      userBonusShare -= numOrders;
    }
  
    bonusRewardDebt = userBonusShare * accBonusRewardPerShare;
    userInfo.rewardsInfo.bonusRewardDebt = bonusRewardDebt;
    userInfo.rewardsInfo.bonusPending = bonusPending;
  }

  incrementLocalRewards({'totalRewardPaid': pending, 'totalBonusRewardPaid': bonusPending});

  return userInfo.rewardsInfo;
}

function incrementLocalRewards({
  totalRewardPaid,
  totalBonusRewardPaid,
  totalFeeRewardPaid,
  accRewardPerShare,
  accBonusRewardPerShare,
  accFeeRewardPerShare
}) {
  localInfo.rewardsInfo.totalRewardPaid += totalRewardPaid || 0;
  localInfo.rewardsInfo.totalBonusRewardPaid += totalBonusRewardPaid || 0;
  localInfo.rewardsInfo.totalFeeRewardPaid += totalFeeRewardPaid || 0;
  localInfo.rewardsInfo.accRewardPerShare += accRewardPerShare || 0;
  localInfo.rewardsInfo.accBonusRewardPerShare += accBonusRewardPerShare || 0;
  localInfo.rewardsInfo.accFeeRewardPerShare += accFeeRewardPerShare || 0;
}

// updates lastRewardBlock, accRewardPerShare, accBonusRewardPerShare
async function updateLocalRewards(hasBonus) {
  utils.log("Updating local rewards");
  const currentBlock = await getCurrentBlock();
  const totalListings = globalInfo.totalListings;
  const rewardPerBlock = globalInfo.rewardsInfo.rewardPerBlock;
  const totalBonusListings = globalInfo.totalBonusListings;
  const bonusRewardPerBlock = globalInfo.rewardsInfo.bonusRewardPerBlock;

  let lastRewardBlock = localInfo.rewardsInfo.lastRewardBlock;

  if (currentBlock <= lastRewardBlock) {
    utils.log("Not updating global rewards since current block <= lastRewardBlock");
    return false;
  }
  if (totalListings == 0) {
    utils.log("Not updating global rewards since total listings are 0");
    return false;
  }
  const multiplier = currentBlock - lastRewardBlock;
  const reward = multiplier * rewardPerBlock;
  localInfo.rewardsInfo.accRewardPerShare += reward / totalListings;
  localInfo.rewardsInfo.lastRewardBlock = currentBlock;

  if (hasBonus) {
    const bonusReward = multiplier * bonusRewardPerBlock;
    localInfo.rewardsInfo.accBonusRewardPerShare += bonusReward / totalBonusListings;
  }
  return true;
}

async function getCurrentBlock() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.alchemyJsonRpcEthMainnet
  );
  const currentBlock = await provider.getBlockNumber();
  utils.log("Current eth block: " + currentBlock);
  return currentBlock;
}

async function getReward(user) {
  utils.log("Getting reward for user", user);

  let userInfo = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  userInfo = { ...getEmptyUserInfo(), ...userInfo.data() };
  userInfo.rewardsInfo = {
    ...getEmptyUserRewardInfo(),
    ...userInfo.rewardsInfo,
  };
  const currentBlock = await getCurrentBlock();
  const totalListings = globalInfo.totalListings;
  const totalBonusListings = globalInfo.totalBonusListings;
  const totalFees = globalInfo.totalFees;

  const penaltyActivated = globalInfo.rewardsInfo.penaltyActivated;
  const penaltyRatio = globalInfo.rewardsInfo.penaltyRatio;
  const rewardPerBlock = globalInfo.rewardsInfo.rewardPerBlock;
  const bonusRewardPerBlock = globalInfo.rewardsInfo.bonusRewardPerBlock;
  const feeRewardPerBlock = globalInfo.rewardsInfo.feeRewardPerBlock;

  const lastRewardBlock = localInfo.rewardsInfo.lastRewardBlock;
  let _accRewardPerShare = localInfo.rewardsInfo.accRewardPerShare;
  let _accBonusRewardPerShare = localInfo.rewardsInfo.accBonusRewardPerShare;
  let _accFeeRewardPerShare = localInfo.rewardsInfo.accFeeRewardPerShare;

  const numSales = userInfo.numSales;
  const numOrders = userInfo.numListings + userInfo.numOffers;
  const numBonusOrders = userInfo.numBonusListings + userInfo.numBonusOffers;
  const feesPaid = userInfo.feesPaid;
  const rewardDebt = userInfo.rewardsInfo.rewardDebt;
  const bonusRewardDebt = userInfo.rewardsInfo.bonusRewardDebt;
  const feeRewardDebt = userInfo.rewardsInfo.feeRewardDebt;
  const pending = userInfo.rewardsInfo.pending;
  const bonusPending = userInfo.rewardsInfo.bonusPending;
  const feePending = userInfo.rewardsInfo.feePending;

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
    const reward = multiplier * feeRewardPerBlock;
    _accFeeRewardPerShare += reward / totalFees;
  }

  const ordersReward = numOrders * _accRewardPerShare - rewardDebt;
  const bonusReward = numBonusOrders * _accBonusRewardPerShare - bonusRewardDebt;
  const feeReward = feesPaid * _accFeeRewardPerShare - feeRewardDebt;
  const grossReward =
    ordersReward +
    bonusReward +
    feeReward +
    pending +
    bonusPending +
    feePending;

  const resp = {
    currentBlock,
    totalListings,
    totalBonusListings,
    totalFees,
    ordersReward,
    bonusReward,
    feeReward,
    grossReward,
    penaltyActivated,
    penaltyRatio,
    rewardPerBlock,
    bonusRewardPerBlock,
    feeRewardPerBlock,
    numSales,
    feesPaid,
    numListings: userInfo.numListings,
    numBonusListings: userInfo.numBonusListings,
    numOffers: userInfo.numOffers,
    numBonusOffers: userInfo.numBonusOffers,
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
      "rewardsInfo.netReward": netReward,
      "rewardsInfo.netRewardCalculatedAt":
        firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    })
    .then((resp) => {
      // nothing to do
    })
    .catch((error) => {
      utils.error("Error updating net reward for user " + user, error);
    });

  return resp;
}
