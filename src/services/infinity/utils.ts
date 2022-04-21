import { ListingMetadata, RewardTiers } from '@infinityxyz/lib/types/core';
import { fstrCnstnts, POLYGON_WYVERN_EXCHANGE_ADDRESS, WYVERN_EXCHANGE_ADDRESS } from '../../constants';
import { checkOwnershipChange } from 'services/ethereum/checkOwnershipChange';
import { getProvider } from 'utils/ethers';
import { error, log, jsonString, NULL_HASH } from '@infinityxyz/lib/utils';
import { Contract, ethers } from 'ethers';
import { deleteExpiredOrder } from './orders/deleteExpiredOrder';
import openseaExchangeContract from 'abi/openseaExchangeContract.json';
import { Provider } from '@ethersproject/abstract-provider';
import { firestore } from 'container';

export function getAssetAsListing(docId: string, data: any) {
  log('Converting asset to listing');
  try {
    const listings: Array<ListingMetadata & { id: string }> = [];
    const listing = data;
    listing.id = docId;
    listings.push(listing);
    const resp = {
      count: listings.length,
      listings
    };
    return resp;
  } catch (err: any) {
    error('Failed to convert asset to listing');
    error(err);
  }
}

export function isOrderExpired(doc: any) {
  const order = doc.data();
  const utcSecondsSinceEpoch = Math.round(Date.now() / 1000);
  const orderExpirationTime = +order.expirationTime;
  if (orderExpirationTime === 0) {
    // Special case of never expire
    return false;
  }
  return orderExpirationTime <= utcSecondsSinceEpoch;
}

export function getOrdersResponse(data: any) {
  return getOrdersResponseFromArray(data.docs);
}

export function getOrdersResponseFromArray(docs: any) {
  const listings: any[] = [];
  for (const doc of docs) {
    const listing = doc.data();
    const isExpired = isOrderExpired(doc);
    try {
      void checkOwnershipChange(doc)
        .then((ownershipChanged) => {
          if (ownershipChanged) {
            void handleStaleListing(doc)
              .then()
              .catch(() => {
                return;
              });
          } else {
            return validateOrder(doc);
          }
        })
        .then((isValid) => {
          if (!isValid) {
            void handleStaleListing(doc)
              .then()
              .catch(() => {
                return;
              });
          }
        })
        .catch((err) => {
          error('error occurred while checking if order is valid');
          error(err);
        });
    } catch (err: any) {
      error('Error checking ownership change info', err);
    }
    if (!isExpired) {
      listing.id = doc.id;
      listings.push(listing);
    } else {
      void deleteExpiredOrder(doc);
    }
  }
  const resp = {
    count: listings.length,
    listings
  };
  return jsonString(resp);
}

export function getEmptyUserProfileInfo() {
  return {
    email: {
      address: '',
      verified: false,
      subscribed: false
    }
  };
}

export function getEmptyUserInfo() {
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
    salesAndPurchasesTotalNumeric: 0,
    rewardsInfo: getEmptyUserRewardInfo()
  };
}

export function getEmptyUserRewardInfo() {
  return {
    share: '0',
    bonusShare: '0',
    salesShare: '0',
    purchasesShare: '0',
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
    openseaVol: 0,
    rewardCalculatedAt: Date.now()
  };
}

export function getUserRewardTier(userVol: number): Record<string, string | number> | null {
  const rewardTiers = RewardTiers;

  if (userVol >= rewardTiers.t1.min && userVol < rewardTiers.t1.max) {
    return rewardTiers.t1;
  } else if (userVol >= rewardTiers.t2.min && userVol < rewardTiers.t2.max) {
    return rewardTiers.t2;
  } else if (userVol >= rewardTiers.t3.min && userVol < rewardTiers.t3.max) {
    return rewardTiers.t3;
  } else if (userVol >= rewardTiers.t4.min && userVol < rewardTiers.t4.max) {
    return rewardTiers.t4;
  } else if (userVol >= rewardTiers.t5.min && userVol < rewardTiers.t5.max) {
    return rewardTiers.t5;
  } else {
    return null;
  }
}

/**
 *
 * @param doc
 * @returns a promise of a boolean indicating whether the order is valid
 */
export async function validateOrder(doc: any): Promise<boolean> {
  try {
    const order = doc?.data?.();
    /**
     * We use order hash to verify that this listing
     * has an actual order
     */
    if (!order.hash) {
      return true;
    }
    let contract;
    const provider = getProvider(order.metadata.chainId);
    switch (order.metadata.chainId) {
      case '1':
        contract = new Contract(WYVERN_EXCHANGE_ADDRESS, openseaExchangeContract, provider as Provider);
        break;

      case '137':
        contract = new Contract(POLYGON_WYVERN_EXCHANGE_ADDRESS, openseaExchangeContract, provider as Provider);
        break;

      default:
        return true;
    }

    const isValid = await contract?.validateOrder_(
      [
        order.exchange,
        order.maker,
        order.taker,
        order.feeRecipient,
        order.target,
        order.staticTarget,
        order.paymentToken
      ],
      [
        order.makerRelayerFee,
        order.takerRelayerFee,
        order.makerProtocolFee,
        order.takerProtocolFee,
        order.basePrice,
        order.extra,
        order.listingTime,
        order.expirationTime,
        order.salt
      ],
      order.feeMethod,
      order.side,
      order.saleKind,
      order.howToCall,
      order.calldata,
      order.replacementPattern,
      order.staticExtradata,
      order.v || 0,
      order.r || NULL_HASH,
      order.s || NULL_HASH
    );

    return isValid;
  } catch (err: any) {
    error('error while checking if order is valid ');
    error(err);
    return true;
  }
}

async function handleStaleListing(doc: any): Promise<void> {
  try {
    const order = doc.data();
    const batch = firestore.db.batch();

    batch.delete(doc.ref);

    const user = order.maker?.trim?.()?.toLowerCase?.();
    if (user && ethers.utils.isAddress(user)) {
      const userStaleListings = firestore
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(user)
        .collection(fstrCnstnts.STALE_LISTINGS_COLL);
      const staleListing = {
        listingTime: parseInt(order.listingTime ?? '', 10),
        basePrice: order.basePrice ?? '',
        taker: order.taker,
        saleKind: order.saleKind,
        maker: order.maker,
        side: order.side,
        metadata: order.metadata,
        expirationTime: order.expirationTime,
        createdAt: Date.now()
      };

      const staleListingId = firestore.getStaleListingDocId({
        tokenAddress: staleListing.metadata.asset.address,
        tokenId: staleListing.metadata.asset.id,
        basePrice: staleListing.basePrice,
        listingTime: staleListing.listingTime
      });
      const staleListingRef = userStaleListings.doc(staleListingId);

      batch.set(staleListingRef, staleListing);
    }

    await batch.commit();
    log(`purged stale listing: Maker ${user}`);
  } catch (err: any) {
    error('error occurred while handling stale listing ');
    error(err);
  }
}
