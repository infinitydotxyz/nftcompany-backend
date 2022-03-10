import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { error, log } from '@infinityxyz/lib/utils';
import { isTokenVerified } from '../collections/isTokenVerified';
import { getUserListingRef } from './getUserListing';
import firebaseAdmin from 'firebase-admin';
import { updateNumOrders } from '../orders/updateNumOrders';

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
  const listingRef = getUserListingRef(maker, { tokenAddress, tokenId, basePrice });
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
    await firestore
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
              imagePreview: payload.metadata.asset.imagePreview || payload.metadata.asset.image
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
