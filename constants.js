/*

Data structure in firestore
	- rootColl
		- infoDoc
			- totalListings
			- totalBonusListings
			- totalOffers
			- totalBonusOffers
			- totalSales
			- totalFees
			- rewardsInfo
				- accRewardPerShare
				- accBonusRewardPerShare
                - accFeeRewardPerShare
				- totalRewardPaid
				- totalBonusRewardPaid
                - totalFeeRewardPaid
				- lastRewardBlock
				- rewardPerBlock
				- bonusRewardPerBlock
                - feeRewardPerBlock
				- penaltyActivated
                - penaltyRatio
			- usersColl
				- userDoc
					- numListings
					- numOffers
					- numBonusListings
					- numBonusOffers
					- numSales
					- feesPaid
					- ens
					- rewardsInfo
						- rewardDebt
						- bonusRewardDebt
                        - feeRewardDebt
                        - pending
                        - bonusPending
                        - feePending
						- netReward
						- netRewardCalculatedAt
					- assetsColl
					- listingsColl
					- offersMadeColl
					- offersRecdColl
					- boughtColl
					- soldColl
			- bonusRewardTokensColl
				- tokenDoc
					- name
					- address
			- verifiedTokensColl
				- tokenDoc
					- name
					- address
*/

module.exports = {
  firestore: {
    ROOT_COLL: "testRoot", //todo: adi change this before push
    //ROOT_COLL: 'root',
    INFO_DOC: "info",
    TOTAL_LISTINGS: "totalListings",
    TOTAL_BONUS_LISTINGS: "totalBonusListings",
    TOTAL_OFFERS: "totalOffers",
    TOTAL_BONUS_OFFERS: "totalBonusOffers",
    TOTAL_SALES: "totalSales",
    TOTAL_FEES: "totalFees",

    VERIFIED_TOKENS_COLL: "verifiedTokens",
    BONUS_REWARD_TOKENS_COLL: "bonusRewardTokens",

    USERS_COLL: "users",
    NUM_LISTINGS: "numListings",
    NUM_BONUS_LISTINGS: "numBonusListings",
    NUM_OFFERS: "numOffers",
    NUM_BONUS_OFFERS: "numBonusOffers",
    NUM_SALES: "numSales",
    FEES_PAID: "feesPaid",
    LISTINGS_COLL: "listings",
    OFFERS_MADE_COLL: "offersMade",
    OFFERS_RECVD_COLL: "offersReceived",
    ASSETS_COLL: "assets",
    BOUGHT_COLL: "bought",
    SOLD_COLL: "sold",
  },

  auth: {
    signature: "X-AUTH-SIGNATURE",
    message: "X-AUTH-MESSAGE",
  },
};
