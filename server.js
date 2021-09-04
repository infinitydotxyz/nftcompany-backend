require('dotenv').config()
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

app.get('/', (req, res) => {
    res.send('Hello from server!')
})

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
    const user = req.params.user
    const assets = await getAssets(user)
    res.send(assets)
})

//fetch listings of user
app.get('/u/:user/listings', async (req, res) => {
    const user = req.params.user
    db.collection(fstrCnstnts.USERS_ROOT_COLL)
        .doc(fstrCnstnts.ALL_DOC)
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
    const tokenAddress = req.query.asset_contract_address
    const tokenId = req.query.token_id
    const side = req.query.side

    const docs = await getOrders(tokenAddress, tokenId, side)
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

// post a listing or make offer
app.post('/wyvern/v1/orders/post', (req, res) => {
    const payload = req.body
    const id = getDocId(payload.metadata.asset.address, payload.metadata.asset.id)
    const maker = payload.maker
    const taker = payload.taker
    // 0 is buy/offer, 1 is sell
    const subColl = payload.side == 0 ? fstrCnstnts.OFFERS_MADE_COLL : fstrCnstnts.LISTINGS_COLL

    if (subColl == fstrCnstnts.LISTINGS_COLL) {
        utils.log('Posting a listing with id ' + id)
        db.collection(fstrCnstnts.USERS_ROOT_COLL)
            .doc(fstrCnstnts.ALL_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(maker)
            .collection(fstrCnstnts.LISTINGS_COLL)
            .doc(id)
            .set(payload)
            .then(resp => {
                res.send(payload)
            }).catch(err => {
                utils.error('Failed to post listing', err)
                res.sendStatus(500)
            })
    } else {
        // store data in offersMade of maker and offersRecd of taker
        const batch = db.batch()

        const offersMadeRef = db.collection(fstrCnstnts.USERS_ROOT_COLL)
            .doc(fstrCnstnts.ALL_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(maker)
            .collection(fstrCnstnts.OFFERS_MADE_COLL)
            .doc(id)
        batch.set(offersMadeRef, payload)

        // multiple offers can be received on the same nft
        const offersRecdRef = db.collection(fstrCnstnts.USERS_ROOT_COLL)
            .doc(fstrCnstnts.ALL_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(taker)
            .collection(fstrCnstnts.OFFERS_RECVD_COLL)
            .doc(id)
            .collection(fstrCnstnts.OFFERS_RECVD_COLL)
            .doc()

        batch.set(offersRecdRef, payload)

        // Commit the batch
        utils.log('Posting an offer with id ' + id)
        batch.commit().then(resp => {
            res.send(payload)
        }).catch(err => {
            utils.error('Failed to post offer', err)
            res.sendStatus(500)
        })
    }

})

// cancel listing
app.delete('/u/:user/listings/:listing', (req, res) => {
    // delete listing and any offers recvd
    const user = req.params.user
    const listing = req.params.listing

    const batch = db.batch()

    const listingRef = db.collection(fstrCnstnts.USERS_ROOT_COLL)
        .doc(fstrCnstnts.ALL_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .doc(listing)

    batch.delete(listingRef)

    // multiple offers can be received on the same nft
    const offersRecdRef = db.collection(fstrCnstnts.USERS_ROOT_COLL)
        .doc(fstrCnstnts.ALL_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.OFFERS_RECVD_COLL)
        .doc(listing)

    batch.delete(offersRecdRef)

    // deleting a doc doesn't delete a sub collection, we have to do it separately
    const subCollPath = fstrCnstnts.USERS_ROOT_COLL + '/' + fstrCnstnts.ALL_DOC + '/' + fstrCnstnts.USERS_COLL + '/' + user
                         + '/' + fstrCnstnts.OFFERS_RECVD_COLL + '/' + listing + '/' + fstrCnstnts.OFFERS_RECVD_COLL;
    
    try {
        // delete in a batch size of 1000
        deleteCollection(subCollPath, 1000)
    } catch (error) {
        utils.error('Error deleting offers received sub collection for listing ' + listing, error)
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

async function getAssets(address) {
    utils.log('Fetching assets for ', address)
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

async function getAssetsFromCovalent(address) {

}

async function getOrders(tokenAddress, tokenId, side) {
    utils.log('Fetching order for ', tokenAddress, tokenId, side)
    const results = await db.collection(constants.firestore.LISTINGS_COLLECTION)
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
    tokenAddress = tokenAddress.trim()
    tokenId = tokenId.trim()
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