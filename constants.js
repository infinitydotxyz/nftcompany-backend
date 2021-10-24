/*

Data structure in firestore
	- rootColl
		- infoDoc
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
					- salesAndPurchasesTotalNumeric: number
					- profileInfo
						- ens
						- email
							- address
							- verified
							- subscribed
							- verificationGuid
					- rewardsInfo
						- openseaVol: numeric
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
    ROOT_COLL: testRoot,
    OPENSEA_COLL: 'combinedOpenseaSnapshot',
    INFO_DOC: 'info',
    COLLECTION_LISTINGS_COLL: 'collectionListings',
    VERIFIED_TOKENS_COLL: 'verifiedTokens',
    VERIFIED_COLLECTIONS_COLL: 'verifiedCollections',
    BONUS_REWARD_TOKENS_COLL: 'bonusRewardTokens',
    USERS_COLL: 'users',
    LISTINGS_COLL: 'listings',
    OFFERS_COLL: 'offers',
    ASSETS_COLL: 'assets',
    PURCHASES_COLL: 'purchases',
    SALES_COLL: 'sales',
    TXNS_COLL: 'txns',
    MISSED_TXNS_COLL: 'missedTxns'
  },

  auth: {
    signature: 'X-AUTH-SIGNATURE',
    message: 'X-AUTH-MESSAGE'
  },

  API_BASE: 'http://localhost:9090',
  SITE_BASE: 'http://localhost:3000',
  SALE_FEES_TO_PURCHASE_FEES_RATIO: 5,

  ETH_CHAIN_ID: 1,
  WYVERN_EXCHANGE_ADDRESS: '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b',
  WYVERN_ATOMIC_MATCH_FUNCTION: 'atomicMatch_',
  WYVERN_CANCEL_ORDER_FUNCTION: 'cancelOrder_',
  NFTC_FEE_ADDRESS: '0xAAdd54c429a6eEBD4514135EaD53d98D0Cc57d57',
  NULL_HASH: '0x0000000000000000000000000000000000000000000000000000000000000000',
  WETH_ADDRESS: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
};
