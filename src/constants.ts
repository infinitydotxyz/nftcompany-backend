import { NFTDataSource, OrderDirection } from './types/Queries';

export const testRoot = process.env.firestoreTestRoot || 'testRoot';

export const fstrCnstnts = {
  ROOT_COLL: testRoot,
  OPENSEA_COLL: 'combinedOpenseaSnapshot',
  INFO_DOC: 'info',
  COLLECTION_LISTINGS_COLL: 'collectionListings',
  ALL_COLLECTIONS_COLL: 'allCollections',
  BONUS_REWARD_TOKENS_COLL: 'bonusRewardTokens',
  USERS_COLL: 'users',
  LISTINGS_COLL: 'listings',
  OFFERS_COLL: 'offers',
  ASSETS_COLL: 'assets',
  PURCHASES_COLL: 'purchases',
  SALES_COLL: 'sales',
  TXNS_COLL: 'txns',
  MISSED_TXNS_COLL: 'missedTxns',
  FEATURED_COLL: 'featuredCollections'
};

export const auth = {
  signature: 'X-AUTH-SIGNATURE',
  message: 'X-AUTH-MESSAGE'
};

export const API_BASE = 'http://localhost:9090';
export const SITE_BASE = 'http://localhost:3000';

export const SALE_FEES_TO_PURCHASE_FEES_RATIO = 5;
export const POLYGON_WYVERN_EXCHANGE_ADDRESS = '0xbfbf0bd8963fe4f5168745ad59da20bf78d6385e';
export const WYVERN_EXCHANGE_ADDRESS = '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b';
export const WYVERN_ATOMIC_MATCH_FUNCTION = 'atomicMatch_';
export const WYVERN_CANCEL_ORDER_FUNCTION = 'cancelOrder_';
export const NFTC_FEE_ADDRESS = '0xAAdd54c429a6eEBD4514135EaD53d98D0Cc57d57';
export const NULL_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export const FEATURED_LIMIT = 4; // number of featured collections

export const OPENSEA_API = 'https://api.opensea.io/api/v1/';

export const DEFAULT_ITEMS_PER_PAGE = 50;
export const DEFAULT_MIN_ETH = 0.0000001;
export const DEFAULT_MAX_ETH = 1000000; // for listings
export const DEFAULT_PRICE_SORT_DIRECTION = OrderDirection.Descending;

export const INFINITY_EMAIL = 'hi@infinity.xyz';
