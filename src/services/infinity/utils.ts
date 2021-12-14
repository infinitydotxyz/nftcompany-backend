import { ListingMetadata } from '@base/types/ListingResponse';
import { RewardTiers } from '@base/types/Rewards';
import { checkOwnershipChange } from '@services/ethereum/checkOwnershipChange';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { deleteExpiredOrder } from './orders/deleteExpiredOrder';

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
  } catch (err) {
    error('Failed to convert asset to listing');
    error(err);
  }
}

export function isOrderExpired(doc: any) {
  const order = doc.data();
  const utcSecondsSinceEpoch = Math.round(Date.now() / 1000);
  const orderExpirationTime = +order.expirationTime;
  if (orderExpirationTime === 0) {
    // special case of never expire
    return false;
  }
  return orderExpirationTime <= utcSecondsSinceEpoch;
}

export function getOrdersResponse(data: any) {
  return getOrdersResponseFromArray(data.docs);
}

export function getOrdersResponseFromArray(docs: any) {
  const listings = [];
  for (const doc of docs) {
    const listing = doc.data();
    const isExpired = isOrderExpired(doc);
    try {
      void checkOwnershipChange(doc);
    } catch (err) {
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
