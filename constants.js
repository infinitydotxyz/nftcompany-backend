/*

Data structure in firestore
	- rootColl
		- infoDoc
			- totalListings: string
			- totalBonusListings: string
			- totalOffers: string
			- totalBonusOffers: string
			- totalSales: string
			- totalFees: string
			- totalVolume: string
			- rewardsInfo
				- accRewardPerShare: string
				- accBonusRewardPerShare: string
                - accSaleRewardPerShare: string
				- accPurchaseRewardPerShare: string
				- totalRewardPaid: string
				- totalBonusRewardPaid: string
                - totalSaleRewardPaid: string
				- totalPurchaseRewardPaid: string
				- lastRewardBlock: string
				- rewardPerBlock: string
				- bonusRewardPerBlock: string
                - saleRewardPerBlock: string
				- purchaseRewardPerBlock: string
				- penaltyActivated: boolean
                - penaltyRatio: string
			- usersColl
				- userDoc
					- numListings: number
					- numOffers: number
					- numBonusListings: number
					- numBonusOffers: number
					- numPurchases: number
					- numSales: number
    				- salesTotal: string
					- salesFeesTotal: string
					- salesTotalNumeric: number
					- salesFeesTotalNumeric: number
					- purchasesTotal: string
					- purchasesFeesTotal: string
					- purchasesTotalNumeric: number
					- purchasesFeesTotalNumeric: number
					- profileInfo
						- ens
						- email
							- address
							- verified
							- subscribed
							- verificationGuid
					- rewardsInfo
						- rewardDebt: string
						- bonusRewardDebt: string
                        - saleRewardDebt: string
						- purchaseRewardDebt: string
                        - pending: string
                        - bonusPending: string
                        - salePending: string
						- purchasePending: string
						- grossReward: string
						- grossRewardNumeric: numeric
						- netReward: string
						- netRewardNumeric: numeric
						- rewardCalculatedAt: numeric millis since epoch utc
					- assetsColl
					- listingsColl
					- offersColl
					- purchasesColl
					- salesColl
					- txnsColl
			- bonusRewardTokensColl
				- tokenDoc
					- name
			- verifiedTokensColl
				- tokenDoc
					- name
*/

require('dotenv').config();
const testRoot = process.env.firestoreTestRoot || 'testRoot';

module.exports = {
  firestore: {
    ROOT_COLL: testRoot, //todo: adi change this before push
    //ROOT_COLL: 'root',
    INFO_DOC: 'info',
    VERIFIED_TOKENS_COLL: 'verifiedTokens',
    BONUS_REWARD_TOKENS_COLL: 'bonusRewardTokens',
    USERS_COLL: 'users',
    LISTINGS_COLL: 'listings',
    OFFERS_COLL: 'offers',
    ASSETS_COLL: 'assets',
    PURCHASES_COLL: 'purchases',
    SALES_COLL: 'sales',
    TXNS_COLL: 'txns'
  },

  auth: {
    signature: 'X-AUTH-SIGNATURE',
    message: 'X-AUTH-MESSAGE'
  },

  //API_BASE: 'https://server.nftcompany.com', // todo: adi
  API_BASE: 'http://localhost:9090'
};
