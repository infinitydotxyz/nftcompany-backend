import { firestore } from '@base/container';
import { UsPersonAnswer } from '@infinityxyz/types/core/Rewards';
import { fstrCnstnts } from '@base/constants';
import { bn } from '@utils/index';
import { error, log } from '@utils/logger';
import { getEmptyUserInfo, getUserRewardTier } from '../utils';
import { getUserInfoRef } from './getUser';
import { refreshUserPendingTxns } from './refreshUserPendingTxns';

/**
 *
 * @param user
 * @returns
 */
export async function getReward(userAddress: string) {
  log('Getting reward for user', userAddress);

  const userRef = await getUserInfoRef(userAddress).get();

  const userOpenseaRef = await firestore.collection(fstrCnstnts.OPENSEA_COLL).doc(userAddress).get();

  let openseaVol = 0;
  let rewardTier: Record<string, string | number> | null = {};
  let hasAirdrop = false;
  if (userOpenseaRef.exists) {
    openseaVol = userOpenseaRef.get('totalVolUSD');
    rewardTier = getUserRewardTier(openseaVol);
    hasAirdrop = true;
  }

  let userStats = userRef.data();
  userStats = { ...getEmptyUserInfo(), ...userStats };

  let usPerson = UsPersonAnswer.none;
  const userProfile = userStats.profileInfo;
  if (userProfile?.usResidentStatus) {
    usPerson = userProfile.usResidentStatus.usPerson;
  }

  const numListings = bn(userStats.numListings);
  const numBonusListings = bn(userStats.numBonusListings);
  const numOffers = bn(userStats.numOffers);
  const numBonusOffers = bn(userStats.numBonusOffers);
  const numPurchases = bn(userStats.numPurchases);
  const numSales = bn(userStats.numSales);

  const salesTotal = bn(userStats.salesFeesTotal);
  const salesFeesTotal = bn(userStats.salesFeesTotal);
  const salesTotalNumeric = userStats.salesTotalNumeric;
  const salesFeesTotalNumeric = userStats.salesFeesTotalNumeric;

  const purchasesTotal = bn(userStats.purchasesTotal);
  const purchasesFeesTotal = bn(userStats.purchasesFeesTotal);
  const purchasesTotalNumeric = userStats.purchasesTotalNumeric;
  const purchasesFeesTotalNumeric = userStats.purchasesFeesTotalNumeric;

  const doneSoFar = +salesTotalNumeric + +purchasesTotalNumeric;

  // initiate refresh pending txns
  void refreshUserPendingTxns(userAddress);

  const resp = {
    numSales: numSales.toString(),
    numPurchases: numPurchases.toString(),
    salesTotal: salesTotal.toString(),
    salesFeesTotal: salesFeesTotal.toString(),
    salesTotalNumeric,
    salesFeesTotalNumeric,
    purchasesTotal: purchasesTotal.toString(),
    purchasesFeesTotal: purchasesFeesTotal.toString(),
    purchasesTotalNumeric,
    purchasesFeesTotalNumeric,
    numListings: numListings.toString(),
    numBonusListings: numBonusListings.toString(),
    numOffers: numOffers.toString(),
    numBonusOffers: numBonusOffers.toString(),
    hasAirdrop,
    openseaVol,
    rewardTier,
    doneSoFar,
    usPerson
  };

  // write net reward to firestore async for leaderboard purpose
  getUserInfoRef(userAddress)
    .set(
      {
        openseaVol: openseaVol,
        rewardCalculatedAt: Date.now()
      },
      { merge: true }
    )
    .catch((err) => {
      error('Error updating reward info for user ' + userAddress);
      error(err);
    });

  return resp;
}
