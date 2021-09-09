require('dotenv').config()
const { ethers } = require("ethers")
const express = require('express')
const axios = require('axios').default
const crypto = require('crypto')
const app = express()
const cors = require('cors')
app.use(express.json())
app.use(cors())

const utils = require("./utils")
const constants = require("./constants")
const fstrCnstnts = constants.firestore

const firebaseAdmin = utils.getFirebaseAdmin()
const db = firebaseAdmin.firestore()

const nftDataSources = {
    '0': 'nftc',
    '1': 'opensea',
    '2': 'unmarshal',
    '3': 'alchemy'
}

// Listen to the App Engine-specified port, or 9090 otherwise
const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
    utils.log(`Server listening on port ${PORT}...`)
})

app.all('/u/*', async (req, res, next) => {
    let authorized = await utils.authorizeUser(
        req.path,
        req.header(constants.auth.signature),
        req.header(constants.auth.message)
    )
    if (authorized) {
        next()
    } else {
        res.status(401).send('Unauthorized')
    }
})

// ================================================ READ ===================================================================

// check if token is verified or has bonus reward
app.get('/token/:tokenAddress/verfiedBonusReward', async (req, res) => {
    const tokenAddress = req.params.tokenAddress.trim().toLowerCase()
    const verified = await isTokenVerified(tokenAddress)
    const bonusReward = await hasBonusReward(tokenAddress)
    let resp = {
        verified, bonusReward
    }
    resp = utils.jsonString(resp)
    // to enable cdn cache
    res.set({
        'Cache-Control': 'must-revalidate, max-age=3600',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
    })
    res.send(resp)
})

// fetch all listings
app.get('/listings', async (req, res) => {
    const price = req.query.price || '5000' // add a default max of 5000 eth
    const sortByPrice = req.query.sortByPrice || 'asc' // ascending default
    db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
        .where("basePriceInEth", "<=", +price)
        .orderBy("basePriceInEth", sortByPrice)
        .get()
        .then(querySnapshot => {
            const data = querySnapshot.docs.map(doc => doc.data())
            res.send(data)
        })
        .catch(err => {
            utils.error('Failed to get listings', err)
            res.sendStatus(500)
        })
})

// fetch assets of user
app.get('/u/:user/assets', async (req, res) => {
    const user = req.params.user.trim().toLowerCase()
    const limit = req.query.limit
    const offset = req.query.offset
    const source = req.query.source
    const sourceName = nftDataSources[source]
    let resp = await getAssets(user, limit, offset, sourceName)
    resp = utils.jsonString(resp)
    // to enable cdn cache
    res.set({
        'Cache-Control': 'must-revalidate, max-age=300',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
    })
    res.send(resp)
})

//fetch listings of user
app.get('/u/:user/listings', async (req, res) => {
    const user = req.params.user.trim().toLowerCase()

    db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .get()
        .then(data => {
            let listings = []
            for (const doc of data.docs) {
                const listing = doc.data()
                listing.id = doc.id
                listings.push(listing)
            }
            const resp = {
                count: listings.length,
                listings: listings
            }
            res.send(resp)
        })
        .catch(err => {
            utils.error('Failed to get user listings for user ' + user, err)
            res.sendStatus(500)
        })
})

// fetch order to fulfill
app.get('/u/:user/wyvern/v1/orders', async (req, res) => {
    const user = req.params.user.trim().toLowerCase()
    const tokenAddress = req.query.asset_contract_address.trim().toLowerCase()
    const tokenId = req.query.token_id
    const side = req.query.side

    const docs = await getOrders(user, tokenAddress, tokenId, side)
    if (docs) {
        let orders = []
        for (const doc of docs) {
            const order = doc.data()
            order.id = doc.id
            orders.push(order)
        }
        const resp = {
            count: orders.length,
            orders: orders
        }
        res.send(resp)
    } else {
        res.sendStatus(404)
    }
})

// fetch user reward
app.get('/u/:user/reward', async (req, res) => {
    const user = req.params.user.trim().toLowerCase()
    let resp = await getReward(user)
    resp = utils.jsonString(resp)
    // to enable cdn cache
    res.set({
        'Cache-Control': 'must-revalidate, max-age=300',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
    })
    res.send(resp)
})

//fetch rewards leaderboard
app.get('/rewards/leaderboard', async (req, res) => {
    db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .orderBy('rewardsInfo.netReward', 'desc')
        .limit(10)
        .get()
        .then(data => {
            let results = []
            for (const doc of data.docs) {
                results.push(doc.data())
            }
            let resp = {
                count: results.length,
                results: results
            }
            resp = utils.jsonString(resp)
            // to enable cdn cache
            res.set({
                'Cache-Control': 'must-revalidate, max-age=600',
                'Content-Length': Buffer.byteLength(resp, 'utf8')
            })
            res.send(resp)
        })
        .catch(err => {
            utils.error('Failed to get leaderboard', err)
            res.sendStatus(500)
        })
})

app.get('/titles', async (req, res) => {
    const startsWith = req.query.startsWith
    if (typeof startsWith === 'string') {
        const endCode = utils.getEndCode(startsWith)
        db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
            .where('metadata.asset.title', '>=', startsWith)
            .where('metadata.asset.title', '<', endCode).limit(10)
            .get()
            .then(data => {
                res.send(data.docs)
            });
    } else {
        res.send([])
    }
})
//=============================================== WRITES =====================================================================

// post a listing or make offer
app.post('/u/:user/wyvern/v1/orders', async (req, res) => {
    const payload = req.body
    const tokenAddress = payload.metadata.asset.address.trim().toLowerCase()
    const tokenId = payload.metadata.asset.id
    const id = getDocId(tokenAddress, tokenId)
    const maker = req.params.user.trim().toLowerCase()
    const taker = payload.taker.trim().toLowerCase()
    // default one order per post call
    const numOrders = 1
    // 0 is buy/offer, 1 is sell
    const subColl = payload.side == 0 ? fstrCnstnts.OFFERS_MADE_COLL : fstrCnstnts.LISTINGS_COLL

    // check if token has bonus if payload instructs so
    let hasBonus = payload.metadata.hasBonusReward
    if (payload.metadata.checkBonusReward) {
        hasBonus = await hasBonusReward(tokenAddress)
    }
    payload.metadata.hasBonusReward = hasBonus
    // update rewards
    const updatedRewards = await getUpdatedRewards(maker, hasBonus, numOrders, true)

    const batch = db.batch()

    if (updatedRewards) {
        // update global rewards data
        const globalRewardsRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
        batch.set(globalRewardsRef,
            { 'rewardsInfo': updatedRewards.updatedGlobalRewardsData },
            { merge: true })

        // update user rewards data
        const userRewardsRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(maker)
        batch.set(userRewardsRef,
            { 'rewardsInfo': updatedRewards.updatedUserRewardsData },
            { merge: true })
    } else {
        utils.log('Not updating rewards data as there are no updates')
    }

    if (subColl == fstrCnstnts.LISTINGS_COLL) {
        // check if token is verified if payload instructs so
        let blueCheck = payload.metadata.hasBlueCheck
        if (payload.metadata.checkBlueCheck) {
            blueCheck = await isTokenVerified(tokenAddress)
        }
        payload.metadata.hasBlueCheck = blueCheck

        // write listing
        const listingRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(maker)
            .collection(fstrCnstnts.LISTINGS_COLL)
            .doc(id)
        batch.set(listingRef, payload, { merge: true })

        // check if doc already exists (in case of edit listing) - only update numlistings if it isn't
        const listing = await listingRef.get()
        if (!listing.exists) {
            utils.log('updating num listings since listing does not exist')
            // update num user listings
            const userNumListingsRef = db.collection(fstrCnstnts.ROOT_COLL)
                .doc(fstrCnstnts.INFO_DOC)
                .collection(fstrCnstnts.USERS_COLL)
                .doc(maker)
            batch.set(userNumListingsRef, { 'numListings': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })

            // update total listings
            const totalNumListingsRef = db.collection(fstrCnstnts.ROOT_COLL)
                .doc(fstrCnstnts.INFO_DOC)
            batch.set(totalNumListingsRef, { 'totalListings': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })
        }
        // update bonus items
        if (hasBonus) {
            utils.log('Token has bonus reward for listing')
            // check if doc already exists (in case of edit listing) - only update numBonuslistings if it isn't
            if (!listing.exists) {
                utils.log('updating num bonus listings since listing does not exist')
                // update num bonus user listings
                const userNumBonusListingsRef = db.collection(fstrCnstnts.ROOT_COLL)
                    .doc(fstrCnstnts.INFO_DOC)
                    .collection(fstrCnstnts.USERS_COLL)
                    .doc(maker)
                batch.set(userNumBonusListingsRef, { 'numBonusListings': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })

                // update total bonus listings
                const totalNumBonusListingsRef = db.collection(fstrCnstnts.ROOT_COLL)
                    .doc(fstrCnstnts.INFO_DOC)
                batch.set(totalNumBonusListingsRef, { 'totalBonusListings': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })
            }
        }

    } else {
        // store data in offersMade of maker and offersRecd of taker
        const offersMadeRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(maker)
            .collection(fstrCnstnts.OFFERS_MADE_COLL)
            .doc(id)
        batch.set(offersMadeRef, payload, { merge: true })

        // multiple offers can be received on the same nft
        const offersRecdRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(taker)
            .collection(fstrCnstnts.OFFERS_RECVD_COLL)
            .doc(id)
            .collection(fstrCnstnts.OFFERS_RECVD_COLL)
            .doc()
        batch.set(offersRecdRef, payload, { merge: true })

        // check if doc already exists (in case of edit offer) - only update numOffers if it isn't
        const offer = await offersMadeRef.get()
        if (!offer.exists) {
            utils.log('updating num offers since offer does not exist')
            // update num user offers made
            const userNumOffersRef = db.collection(fstrCnstnts.ROOT_COLL)
                .doc(fstrCnstnts.INFO_DOC)
                .collection(fstrCnstnts.USERS_COLL)
                .doc(maker)
            batch.set(userNumOffersRef, { 'numOffers': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })

            // update total offers made
            const totalNumOffersRef = db.collection(fstrCnstnts.ROOT_COLL)
                .doc(fstrCnstnts.INFO_DOC)
            batch.set(totalNumOffersRef, { 'totalOffers': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })
        }
        if (hasBonus) {
            utils.log('Token has bonus reward for offers made')
            // check if doc already exists (in case of edit offer) - only update numBonusOffers if it isn't
            if (!offer.exists) {
                utils.log('updating num bonus offers since bonus does not exist')
                // update num bonus user offers
                const userNumBonusOffersRef = db.collection(fstrCnstnts.ROOT_COLL)
                    .doc(fstrCnstnts.INFO_DOC)
                    .collection(fstrCnstnts.USERS_COLL)
                    .doc(maker)
                batch.set(userNumBonusOffersRef, { 'numBonusOffers': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })

                // update total bonus offers
                const totalNumBonusOffersRef = db.collection(fstrCnstnts.ROOT_COLL)
                    .doc(fstrCnstnts.INFO_DOC)
                batch.set(totalNumBonusOffersRef, { 'totalBonusOffers': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })
            }
        }
    }

    // commit batch
    utils.log('Posting an order with id ' + id)
    batch.commit().then(resp => {
        res.send(payload)
    }).catch(err => {
        utils.error('Failed to post order', err)
        res.sendStatus(500)
    })
})

// cancel listing
app.delete('/u/:user/listings/:listing', async (req, res) => {
    // delete listing and any offers recvd
    const user = req.params.user.trim().toLowerCase()
    const listing = req.params.listing.trim().toLowerCase()
    const hasBonus = req.query.hasBonusReward
    const numOrders = 1

    // check if listing exists first
    const listingRef = db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .doc(listing)
    if (!(await listingRef.get()).exists) {
        utils.log('No listing ' + listing + ' to delete')
        return
    }

    const batch = db.batch()

    const updatedRewards = await getUpdatedRewards(user, hasBonus, numOrders, false)

    if (updatedRewards) {
        // update global rewards data
        const globalRewardsRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
        batch.set(globalRewardsRef,
            { 'rewardsInfo': updatedRewards.updatedGlobalRewardsData },
            { merge: true })

        // update user rewards data
        const userRewardsRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(user)
        batch.set(userRewardsRef,
            { 'rewardsInfo': updatedRewards.updatedUserRewardsData },
            { merge: true })
    } else {
        utils.log('Not updating rewards data as there are no updates')
    }

    // delete listing
    batch.delete(listingRef)

    // multiple offers can be received on the same nft
    const offersRecdRef = db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.OFFERS_RECVD_COLL)
        .doc(listing)
    batch.delete(offersRecdRef)

    // deleting a doc doesn't delete a sub collection, we have to do it separately
    const subCollPath = fstrCnstnts.ROOT_COLL + '/' + fstrCnstnts.INFO_DOC + '/' + fstrCnstnts.USERS_COLL + '/' + user
        + '/' + fstrCnstnts.OFFERS_RECVD_COLL + '/' + listing + '/' + fstrCnstnts.OFFERS_RECVD_COLL
    try {
        // delete in a batch size of 1000
        deleteCollection(subCollPath, 1000)
    } catch (error) {
        utils.error('Error deleting offers received sub collection for listing ' + listing, error)
    }

    // update num user listings
    const userNumListingsRef = db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
    batch.set(userNumListingsRef, { 'numListings': firebaseAdmin.firestore.FieldValue.increment(-1 * numOrders) }, { merge: true })

    // update total listings
    const totalNumListingsRef = db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
    batch.set(totalNumListingsRef, { 'totalListings': firebaseAdmin.firestore.FieldValue.increment(-1 * numOrders) }, { merge: true })

    // update bonus data
    if (hasBonus) {
        utils.log('Token has bonus reward for listing')
        // update num bonus user listings
        const userNumBonusListingsRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(user)
        batch.set(userNumBonusListingsRef, { 'numBonusListings': firebaseAdmin.firestore.FieldValue.increment(-1 * numOrders) }, { merge: true })

        // update total bonus listings
        const totalNumBonusListingsRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
        batch.set(totalNumBonusListingsRef, { 'totalBonusListings': firebaseAdmin.firestore.FieldValue.increment(-1 * numOrders) }, { merge: true })
    }

    // Commit the batch
    utils.log('Deleting a listing with id ' + listing)
    batch.commit().then(resp => {
        res.sendStatus(200)
    }).catch(err => {
        utils.error('Failed to delete listing ' + listing, err)
        res.sendStatus(500)
    })
})

// order fulfilled
app.post('/u/:user/wyvern/v1/orders/fulfilled', (req, res) => {
    // write to bought and sold and delete from listing, offer made, offer recvd
})

// ====================================================== HELPERS ==========================================================

async function isTokenVerified(address) {
    const doc = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.VERIFIED_TOKENS_COLL)
        .doc(address)
        .get()
    return doc.exists
}

async function getAssets(address, limit, offset, sourceName) {
    utils.log('Fetching assets for', address)
    const results = await getAssetsFromChain(address, limit, offset, sourceName)
    return results
}

async function getAssetsFromChain(address, limit, offset, sourceName) {
    let data
    switch (sourceName) {
        case 'nftc':
            data = await getAssetsFromNftc(address, limit, offset)
            break
        case 'alchemy':
            data = await getAssetsFromAlchemy(address, limit, offset)
            break
        case 'unmarshal':
            data = await getAssetsFromUnmarshal(address, limit, offset)
            break
        case 'opensea':
            data = await getAssetsFromOpensea(address, limit, offset)
            break
        default:
            utils.log('Invalid data source for fetching nft data of wallet')
    }
    return data
}
async function getAssetsFromNftc(address, limit, offset) {
    utils.log('Fetching assets from nftc')
    return
}

async function getAssetsFromAlchemy(address, limit, offset) {
    utils.log('Fetching assets from alchemy')
    return
}

async function getAssetsFromUnmarshal(address, limit, offset) {
    utils.log('Fetching assets from unmarshal')
    const apiBase = 'https://api.unmarshal.com/v1/'
    const chain = 'ethereum'
    const authKey = process.env.unmarshalKey
    const url = apiBase + chain + '/address/' + address + '/nft-assets?auth_key=' + authKey
    try {
        const { data } = await axios.get(url)
        return data
    } catch (error) {
        utils.error('Error occured while fetching assets from unmarshal', error)
        return
    }
}

async function getAssetsFromOpensea(address, limit, offset) {
    utils.log('Fetching assets from opensea')
    const apiBase = 'https://api.opensea.io/api/v1/assets/'
    const authKey = process.env.openseaKey
    const url = apiBase + '?limit=' + limit + '&offset=' + offset + '&owner=' + address
    const options = {
        headers: {
            'X-API-KEY': authKey
        }
    }
    try {
        utils.log(url)
        const { data } = await axios.get(url, options)
        return data
    } catch (error) {
        utils.error('Error occured while fetching assets from opensea', error)
        return
    }
}

async function getOrders(maker, tokenAddress, tokenId, side) {
    utils.log('Fetching order for', maker, tokenAddress, tokenId, side)
    const results = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(maker)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .where('metadata.asset.address', '==', tokenAddress)
        .where('metadata.asset.id', '==', tokenId)
        .where('side', '==', parseInt(side))
        .get()

    if (results.empty) {
        utils.log('No matching orders')
        return
    }
    return results.docs
}


function getDocId(tokenAddress, tokenId) {
    const data = tokenAddress + tokenId
    const id = crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase()
    utils.log('Doc id for token address ' + tokenAddress + ' and token id ' + tokenId + ' is ' + id)
    return id
}

async function deleteCollection(collectionPath, batchSize) {
    utils.log('Deleting collection at', collectionPath)
    const collectionRef = db.collection(collectionPath)
    const query = collectionRef.orderBy('__name__').limit(batchSize)
    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject)
    })
}

async function deleteQueryBatch(query, resolve) {
    const snapshot = await query.get()
    const batchSize = snapshot.size
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve()
        return
    }
    // Delete documents in a batch
    const batch = db.batch()
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
    })
    await batch.commit()
    // Recurse on the next process tick, to avoid exploding the stack
    process.nextTick(() => {
        deleteQueryBatch(query, resolve)
    })
}


// =============================================== Rewards calc logic ========================================================

async function hasBonusReward(address) {
    const doc = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
        .doc(address)
        .get()
    return doc.exists
}

async function getUpdatedRewards(user, hasBonus, numOrders, isIncrease) {
    utils.log('Getting updated reward for user', user)

    let userInfo = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .get()
    userInfo = { ...getEmptyUserInfo(), ...userInfo.data() }
    userInfo.rewardsInfo = { ...getEmptyUserRewardInfo(), ...userInfo.rewardsInfo }

    let globalInfo = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .get()
    globalInfo = { ...getEmptyGlobalInfo(), ...globalInfo.data() }
    globalInfo.rewardsInfo = { ...getEmptyGlobalInfo().rewardsInfo, ...globalInfo.rewardsInfo }

    let updatedRewards
    if (isIncrease) {
        updatedRewards = await increaseShare(hasBonus, numOrders, userInfo, globalInfo)
    } else {
        updatedRewards = await decreaseShare(hasBonus, numOrders, userInfo, globalInfo)
    }
    return updatedRewards
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
        }
    }
}

function getEmptyUserInfo() {
    return {
        numListings: 0,
        numBonusListings: 0,
        numOffers: 0,
        numBonusOffers: 0,
        numSales: 0,
        feesPaid: 0,
        ens: '',
        rewardsInfo: getEmptyUserRewardInfo()
    }
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
        netRewardCalculatedAt: 0
    }
}

// This function increase user's share and updates the global share
// the user's actual share percentage is calculated by userShare / globalShare
async function increaseShare(hasBonus, numOrders, userInfo, globalInfo) {
    utils.log('Increasing share')

    let userShare = userInfo.numListings + userInfo.numOffers
    let rewardDebt = userInfo.rewardsInfo.rewardDebt
    let totalRewardPaid = globalInfo.rewardsInfo.totalRewardPaid

    const updatedGlobalRewardsData = await updateGlobalRewards(globalInfo, hasBonus)
    if (!updatedGlobalRewardsData) {
        utils.log('Not increasing share as updatedGlobalRewardsData is empty')
        return
    }
    const accRewardPerShare = updatedGlobalRewardsData.accRewardPerShare

    let pending = 0
    if (userShare > 0) {
        pending = (userShare * accRewardPerShare) - rewardDebt
        totalRewardPaid = totalRewardPaid + pending
    }
    // add current value before reward debt calc
    userShare += numOrders
    rewardDebt = userShare * accRewardPerShare

    updatedGlobalRewardsData.totalRewardPaid = totalRewardPaid
    userInfo.rewardsInfo.rewardDebt = rewardDebt
    userInfo.rewardsInfo.pending = pending

    if (hasBonus) {
        let userBonusShare = userInfo.numBonusListings + userInfo.numBonusOffers
        let bonusRewardDebt = userInfo.rewardsInfo.bonusRewardDebt
        let totalBonusRewardPaid = globalInfo.rewardsInfo.totalBonusRewardPaid
        const accBonusRewardPerShare = updatedGlobalRewardsData.accBonusRewardPerShare
        let bonusPending = 0
        if (userBonusShare > 0) {
            bonusPending = (userBonusShare * accBonusRewardPerShare) - bonusRewardDebt
            totalBonusRewardPaid = totalBonusRewardPaid + bonusPending
        }
        // add current value before reward debt calc
        userBonusShare += numOrders
        bonusRewardDebt = userBonusShare * accBonusRewardPerShare

        updatedGlobalRewardsData.totalBonusRewardPaid = totalBonusRewardPaid
        userInfo.rewardsInfo.bonusRewardDebt = bonusRewardDebt
        userInfo.rewardsInfo.bonusPending = bonusPending
    }

    return {
        updatedGlobalRewardsData: updatedGlobalRewardsData,
        updatedUserRewardsData: userInfo.rewardsInfo
    }
}

// This function will decreases user's share by value, and updates the global share
// it will record which block this is happening and accumulates the area of (share * time)
async function decreaseShare(hasBonus, numOrders, userInfo, globalInfo) {
    utils.log('Decreasing share')

    let userShare = userInfo.numListings + userInfo.numOffers
    if (userShare < numOrders) {
        utils.error('cannot decrease share')
        return
    }

    let rewardDebt = userInfo.rewardsInfo.rewardDebt
    let totalRewardPaid = globalInfo.rewardsInfo.totalRewardPaid

    const updatedGlobalRewardsData = await updateGlobalRewards(globalInfo, hasBonus)
    if (!updatedGlobalRewardsData) {
        utils.log('Not decreasing share as updatedGlobalRewardsData is empty')
        return
    }
    const accRewardPerShare = updatedGlobalRewardsData.accRewardPerShare

    let pending = (userShare * accRewardPerShare) - rewardDebt
    totalRewardPaid = totalRewardPaid + pending
    // decrease userShare before rewardDebt calc
    userShare -= numOrders
    rewardDebt = userShare * accRewardPerShare

    updatedGlobalRewardsData.totalRewardPaid = totalRewardPaid
    userInfo.rewardsInfo.rewardDebt = rewardDebt
    userInfo.rewardsInfo.pending = pending

    if (hasBonus) {
        let userBonusShare = userInfo.numBonusListings + userInfo.numBonusOffers
        if (userBonusShare < numOrders) {
            utils.error('cannot decrease bonus share')
            return
        }

        let bonusRewardDebt = userInfo.rewardsInfo.bonusRewardDebt
        let totalBonusRewardPaid = globalInfo.rewardsInfo.totalBonusRewardPaid

        const accBonusRewardPerShare = updatedGlobalRewardsData.accBonusRewardPerShare

        let bonusPending = (userBonusShare * accBonusRewardPerShare) - bonusRewardDebt
        totalBonusRewardPaid = totalBonusRewardPaid + bonusPending
        // decrease userShare before rewardDebt calc
        userBonusShare -= numOrders
        bonusRewardDebt = userBonusShare * accBonusRewardPerShare

        updatedGlobalRewardsData.totalBonusRewardPaid = totalBonusRewardPaid
        userInfo.rewardsInfo.bonusRewardDebt = bonusRewardDebt
        userInfo.rewardsInfo.bonusPending = bonusPending
    }

    return {
        updatedGlobalRewardsData: updatedGlobalRewardsData,
        updatedUserRewardsData: userInfo.rewardsInfo
    }
}

// Update reward variables of the given pool to be up-to-date
async function updateGlobalRewards(globalInfo, hasBonus) {
    utils.log('Updating global rewards')

    const totalListings = globalInfo.totalListings
    const rewardPerBlock = globalInfo.rewardsInfo.rewardPerBlock
    let lastRewardBlock = globalInfo.rewardsInfo.lastRewardBlock
    let accRewardPerShare = globalInfo.rewardsInfo.accRewardPerShare
    const currentBlock = await getCurrentBlock()

    if (currentBlock <= lastRewardBlock) {
        utils.log('Not updating global rewards since current block <= lastRewardBlock')
        return
    }
    if (totalListings == 0) {
        utils.log('Not updating global rewards since totallistings are 0')
        lastRewardBlock = currentBlock
        return
    }
    const multiplier = currentBlock - lastRewardBlock
    const reward = multiplier * rewardPerBlock
    accRewardPerShare = accRewardPerShare + (reward / totalListings)
    lastRewardBlock = currentBlock

    const updatedRewardsData = globalInfo.rewardsInfo
    updatedRewardsData.accRewardPerShare = accRewardPerShare
    updatedRewardsData.lastRewardBlock = lastRewardBlock

    if (hasBonus) {
        const totalBonusListings = globalInfo.totalBonusListings
        const bonusRewardPerBlock = globalInfo.rewardsInfo.bonusRewardPerBlock
        let accBonusRewardPerShare = globalInfo.rewardsInfo.accBonusRewardPerShare
        const bonusReward = multiplier * bonusRewardPerBlock
        accBonusRewardPerShare = accBonusRewardPerShare + (bonusReward / totalBonusListings)
        updatedRewardsData.accBonusRewardPerShare = accBonusRewardPerShare
    }
    return updatedRewardsData
}

async function getCurrentBlock() {
    const provider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet)
    const currentBlock = await provider.getBlockNumber()
    utils.log('Current eth block: ' + currentBlock)
    return currentBlock
}

async function getReward(user) {
    utils.log('Getting reward for user', user)

    let userInfo = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .get()
    userInfo = { ...getEmptyUserInfo(), ...userInfo.data() }
    userInfo.rewardsInfo = { ...getEmptyUserRewardInfo(), ...userInfo.rewardsInfo }

    let globalInfo = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .get()
    globalInfo = { ...getEmptyGlobalInfo(), ...globalInfo.data() }
    globalInfo.rewardsInfo = { ...getEmptyGlobalInfo().rewardsInfo, ...globalInfo.rewardsInfo }

    const currentBlock = await getCurrentBlock()

    const totalListings = globalInfo.totalListings
    const totalBonusListings = globalInfo.totalBonusListings
    const totalFees = globalInfo.totalFees

    const lastRewardBlock = globalInfo.rewardsInfo.lastRewardBlock
    const penaltyActivated = globalInfo.rewardsInfo.penaltyActivated
    const penaltyRatio = globalInfo.rewardsInfo.penaltyRatio
    const rewardPerBlock = globalInfo.rewardsInfo.rewardPerBlock
    const bonusRewardPerBlock = globalInfo.rewardsInfo.bonusRewardPerBlock
    const feeRewardPerBlock = globalInfo.rewardsInfo.feeRewardPerBlock
    let _accRewardPerShare = globalInfo.rewardsInfo.accRewardPerShare
    let _accBonusRewardPerShare = globalInfo.rewardsInfo.accBonusRewardPerShare
    let _accFeeRewardPerShare = globalInfo.rewardsInfo.accFeeRewardPerShare

    const numSales = userInfo.numSales
    const numOrders = userInfo.numListings + userInfo.numOffers
    const numBonusOrders = userInfo.numBonusListings + userInfo.numBonusOffers
    const feesPaid = userInfo.feesPaid
    const rewardDebt = userInfo.rewardsInfo.rewardDebt
    const bonusRewardDebt = userInfo.rewardsInfo.bonusRewardDebt
    const feeRewardDebt = userInfo.rewardsInfo.feeRewardDebt
    const pending = userInfo.rewardsInfo.pending
    const bonusPending = userInfo.rewardsInfo.bonusPending
    const feePending = userInfo.rewardsInfo.feePending

    if (currentBlock > lastRewardBlock && totalListings != 0) {
        const multiplier = currentBlock - lastRewardBlock
        const reward = multiplier * rewardPerBlock
        _accRewardPerShare = _accRewardPerShare + (reward / totalListings)
    }
    if (currentBlock > lastRewardBlock && totalBonusListings != 0) {
        const multiplier = currentBlock - lastRewardBlock
        const reward = multiplier * bonusRewardPerBlock
        _accBonusRewardPerShare = _accBonusRewardPerShare + (reward / totalBonusListings)
    }
    if (currentBlock > lastRewardBlock && totalFees != 0) {
        const multiplier = currentBlock - lastRewardBlock
        const reward = multiplier * feeRewardPerBlock
        _accFeeRewardPerShare = _accFeeRewardPerShare + (reward / totalFees)
    }

    const ordersReward = (numOrders * _accRewardPerShare) - rewardDebt
    const bonusReward = (numBonusOrders * _accBonusRewardPerShare) - bonusRewardDebt
    const feeReward = (feesPaid * _accFeeRewardPerShare) - feeRewardDebt
    const grossReward = ordersReward + bonusReward + feeReward + pending + bonusPending + feePending

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
        numBonusOffers: userInfo.numBonusOffers
    }

    let netReward = 0
    if (penaltyActivated) {
        const salesRatio = numSales / (numOrders + numBonusOrders)
        const penalty = (penaltyRatio - salesRatio) * grossReward
        // the edge case where all orders are fulfilled
        if (penalty < 0) {
            penalty = 0
        }
        netReward = grossReward - penalty
        resp.penalty = penalty
        resp.netReward = netReward
    } else {
        resp.penalty = 0
        resp.netReward = grossReward
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
        .then(resp => {
            // nothing to do
        })
        .catch(error => {
            utils.error('Error updating net reward for user ' + user, error)
        })

    return resp
}