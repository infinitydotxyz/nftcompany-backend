import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts, NFTC_FEE_ADDRESS } from '@constants';
import { hasBonusReward } from '@services/infinity/collections/hasBonusReward';
import { isTokenVerified } from '@services/infinity/collections/isTokenVerified';
import { updateNumOrders } from '@services/infinity/orders/updateNumOrders';
import { error, log } from '@utils/logger';
import { Request, Response } from 'express';
import firebaseAdmin from 'firebase-admin';
import { prepareEmail } from '../../reward';

// post a listing or make offer
export const postUserOrders = async (req: Request<{ user: string }>, res: Response) => {
  const payload = req.body;

  if (Object.keys(payload).length === 0) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
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
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  if (
    !payload.englishAuctionReservePrice &&
    (!payload.feeRecipient || payload.feeRecipient.trim().toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase())
  ) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  if (payload.metadata.asset.id === undefined || payload.metadata.asset.id === null) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();

  const maker = (`${req.params.user}` || '').trim().toLowerCase();
  if (!maker) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }
  // default one order per post call
  const numOrders = 1;
  const batch = firestore.db.batch();
  log('Making an order for user: ' + maker);
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
      error('Unknown order type');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    // commit batch
    log('Committing post order batch to firestore');
    batch
      .commit()
      .then((resp: any) => {
        res.send(payload);
      })
      .catch((err: Error) => {
        error('Failed to post order');
        error(err);
        res.sendStatus(StatusCode.InternalServerError);
      });
  } catch (err) {
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

export async function postListing(maker: string, payload: any, batch: any, numOrders: number, hasBonus: boolean) {
  log('Writing listing to firestore for user + ' + maker);
  const { basePrice } = payload;
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  const tokenId = payload.metadata.asset.id.trim();
  const chainId = payload.metadata.chainId;

  // check if token is verified if payload instructs so
  let blueCheck = payload.metadata.hasBlueCheck;
  if (payload.metadata.checkBlueCheck) {
    blueCheck = await isTokenVerified(tokenAddress);
  }
  payload.metadata.hasBlueCheck = blueCheck;
  payload.metadata.createdAt = Date.now();

  // write listing
  const listingRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc(firestore.getDocId({ tokenAddress, tokenId, basePrice }));

  batch.set(listingRef, payload, { merge: true });

  // store as asset for future use
  const listingAsAssetRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.ASSETS_COLL)
    .doc(firestore.getAssetDocId({ tokenAddress, tokenId, chainId }));

  batch.set(listingAsAssetRef, payload, { merge: true });

  // update collection listings
  try {
    firestore
      .collection(fstrCnstnts.COLLECTION_LISTINGS_COLL)
      .doc(tokenAddress)
      .set(
        {
          numListings: firebaseAdmin.firestore.FieldValue.increment(numOrders),
          metadata: {
            hasBlueCheck: payload.metadata.hasBlueCheck,
            schema: payload.metadata.schema,
            chainId,
            asset: {
              address: tokenAddress,
              collectionName: payload.metadata.asset.collectionName,
              searchCollectionName: payload.metadata.asset.searchCollectionName,
              description: payload.metadata.asset.description,
              image: payload.metadata.asset.image,
              imagePreview: payload.metadata.asset.imagePreview
            }
          }
        },
        { merge: true }
      );
  } catch (err) {
    error('Error updating root collection data on post listing');
    error(err);
  }

  // update num user listings
  updateNumOrders(batch, maker, numOrders, hasBonus, 1);
}

export async function postOffer(maker: string, payload: any, batch: any, numOrders: number, hasBonus: boolean) {
  log('Writing offer to firestore for user', maker);
  const taker = payload.metadata.asset.owner.trim().toLowerCase();
  const { basePrice } = payload;
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  const tokenId = payload.metadata.asset.id.trim();
  payload.metadata.createdAt = Date.now();

  // store data in offers of maker
  const offerRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.OFFERS_COLL)
    .doc(firestore.getDocId({ tokenAddress, tokenId, basePrice }));
  batch.set(offerRef, payload, { merge: true });

  log('updating num offers since offer does not exist');
  // update num user offers made
  updateNumOrders(batch, maker, numOrders, hasBonus, 0);

  // send email to taker that an offer is made
  prepareEmail(taker, payload, 'offerMade');
}
