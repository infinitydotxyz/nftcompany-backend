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

// Listen to the App Engine-specified port, or 9090 otherwise
const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
    utils.log(`Server listening on port ${PORT}...`)
})

//todo: uncomment auth requirement in this and all other imported files that serve end points
// app.all('/users/*', async (req, res, next) => {
//     let authorized = await utils.authorizeUser(req.path, req.header(constants.firebaseAuth.authTokenHeader))
//     if (authorized) {
//       next()
//     } else {
//       res.status(401).send('Unauthorized')
//     }
// })

// ================================================ READ ===================================================================

// fetch all listings
app.get('/listings', async (req, res) => {
    db.collectionGroup(fstrCnstnts.LISTINGS_COLL)
        .get()
        .then(querySnapshot => {
            res.send(querySnapshot.docs[1].data())
        }).catch(err => {
            utils.error('Failed to get listings', err)
            res.sendStatus(500)
        })
})

// fetch assets of user
app.get('/u/:user/assets', async (req, res) => {
    const user = req.params.user.trim().toLowerCase()
    const assets = await getAssets(user)
    res.send(assets)
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
        }).catch(err => {
            utils.error('Failed to get user listings for user ' + user, err)
            res.sendStatus(500)
        })
})

// fetch order to fulfill
app.get('/wyvern/v1/orders', async (req, res) => {
    const maker = req.query.maker.trim().toLowerCase()
    const tokenAddress = req.query.asset_contract_address.trim().toLowerCase()
    const tokenId = req.query.token_id
    const side = req.query.side

    const docs = await getOrders(maker, tokenAddress, tokenId, side)
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

//=============================================== WRITES =====================================================================

// post a listing or make offer
app.post('/wyvern/v1/orders/post', async (req, res) => {
    const payload = req.body
    const tokenAddress = payload.metadata.asset.address.trim().toLowerCase()
    const tokenId = payload.metadata.asset.id
    const id = getDocId(tokenAddress, tokenId)
    const maker = payload.maker.trim().toLowerCase()
    const taker = payload.taker.trim().toLowerCase()
    // default one order per post call
    const numOrders = 1
    // 0 is buy/offer, 1 is sell
    const subColl = payload.side == 0 ? fstrCnstnts.OFFERS_MADE_COLL : fstrCnstnts.LISTINGS_COLL

    // check if token has bonus
    const hasBonus = await hasBonusReward(tokenAddress)
    const updatedRewards = await getUpdatedRewards(maker, hasBonus, numOrders, true)

    const batch = db.batch()

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

    if (subColl == fstrCnstnts.LISTINGS_COLL) {
        // write listing
        const listingRef = db.collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(maker)
            .collection(fstrCnstnts.LISTINGS_COLL)
            .doc(id)
        batch.set(listingRef, payload, { merge: true })

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

        // update bonus items
        if (hasBonus) {
            utils.log('Token has bonus reward for listing')
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

        if (hasBonus) {
            utils.log('Token has bonus reward for offers made')
            // update num bonus user listings
            const userNumBonusOffersRef = db.collection(fstrCnstnts.ROOT_COLL)
                .doc(fstrCnstnts.INFO_DOC)
                .collection(fstrCnstnts.USERS_COLL)
                .doc(maker)
            batch.set(userNumBonusOffersRef, { 'numBonusOffers': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })

            // update total bonus listings
            const totalNumBonusOffersRef = db.collection(fstrCnstnts.ROOT_COLL)
                .doc(fstrCnstnts.INFO_DOC)
            batch.set(totalNumBonusOffersRef, { 'totalBonusOffers': firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true })
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
    const listing = req.params.listing
    const tokenAddress = req.query.tokenAddress.trim().toLowerCase()
    const numOrders = 1

    // check if token has bonus
    const hasBonus = await hasBonusReward(tokenAddress)
    const updatedRewards = await getUpdatedRewards(user, hasBonus, numOrders, false)

    const batch = db.batch()

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

    const listingRef = db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .doc(listing)
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
app.post('/wyvern/v1/orders/fulfilled', (req, res) => {
    // write to bought and sold and delete from listing, offer made, offer recvd
})

// ====================================================== HELPERS ==========================================================

async function getAssets(address) {
    utils.log('Fetching assets for', address)
    const results = await getAssetsFromChain(address)
    return results
}

async function getAssetsFromChain(address) {
    // call covalent or alchemy or unmarshall or opensea api

    //unmarshal
    const data = await getAssetsFromUnmarshal(address)
    return data

    // covalent

    // alchemy

    // opensea
}

async function getAssetsFromUnmarshal(address) {
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
    const id = crypto.createHash('sha256').update(data).digest('base64')
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

    const userInfo = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .get()

    const globalInfo = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .get()

    let updatedRewards
    if (isIncrease) {
        updatedRewards = await increaseShare(hasBonus, numOrders, userInfo, globalInfo)
    } else {
        updatedRewards = await decreaseShare(hasBonus, numOrders, userInfo, globalInfo)
    }
    return updatedRewards
}

// This function increase user's share and updates the global share
// the user's actual share percentage is calculated by userShare / globalShare
async function increaseShare(hasBonus, numOrders, userInfo, globalInfo) {
    let userShare = userInfo.numListings + userInfo.numOffers
    let rewardDebt = userInfo.rewardsInfo.rewardDebt
    let totalRewardPaid = globalInfo.rewardsInfo.totalRewardPaid

    const updatedGlobalRewardsData = await updateGlobalRewards(globalInfo, hasBonus)
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
    let userShare = userInfo.numListings + userInfo.numOffers
    if (userShare < numOrders) {
        utils.error('cannot decrease share')
        return
    }

    let rewardDebt = userInfo.rewardsInfo.rewardDebt
    let totalRewardPaid = globalInfo.rewardsInfo.totalRewardPaid

    const updatedGlobalRewardsData = updateGlobalRewards(globalInfo, hasBonus)
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
    const totalListings = globalInfo.totalListings
    const rewardPerBlock = globalInfo.rewardsInfo.rewardPerBlock
    let lastRewardBlock = globalInfo.rewardsInfo.lastRewardBlock
    let accRewardPerShare = globalInfo.rewardsInfo.accRewardPerShare
    const currentBlock = await getCurrentBlock()

    if (currentBlock <= lastRewardBlock) {
        return
    }
    if (totalListings == 0) {
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
    return currentBlock
}

async function getReward(user) {
    utils.log('Getting reward for user', user)

    const userInfo = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .get()

    const globalInfo = await db.collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .get()

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

    const reward = (numOrders * _accRewardPerShare) - rewardDebt
    const bonusReward = (numBonusOrders * _accBonusRewardPerShare) - bonusRewardDebt
    const feeReward = (feesPaid * _accFeeRewardPerShare) - feeRewardDebt

    const grossReward = reward + bonusReward + feeReward
    if (penaltyActivated) {
        const salesRatio = numSales / (numOrders + numBonusOrders)
        const penalty = (penaltyRatio - salesRatio) * grossReward
        // the edge case where all orders are fulfilled
        if (penalty < 0) {
            penalty = 0
        }
        const netReward = grossReward - penalty
        return netReward
    } else {
        return grossReward
    }
}