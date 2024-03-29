import { OrderDirection } from '@infinityxyz/lib/types/core';
import { warn } from '@infinityxyz/lib/utils/logger';
import 'dotenv/config';

const getEnvironmentVariable = (name: string, required = true) => {
  const variable = process.env[name];
  if (required && !variable) {
    // Throw new Error(`Missing environment variable ${name}`);
  }
  return variable;
};

export const TEST_ROOT = getEnvironmentVariable('firestoreTestRoot', false) ?? 'testRoot';
export const COVALENT_API_KEY = getEnvironmentVariable('covalentKey');
export const UNMARSHALL_API_KEY = getEnvironmentVariable('unmarshalKey');
export const ALCHEMY_JSON_RPC_ETH_MAINNET = getEnvironmentVariable('alchemyJsonRpcEthMainnet');
export const ALCHEMY_JSON_RPC_POLYGON_MAINNET = getEnvironmentVariable('alchemyJsonRpcPolygonMainnet');
export const OPENSEA_API_KEY = getEnvironmentVariable('openseaKey');
export const TWITTER_BEARER_TOKEN = getEnvironmentVariable('twitterBearerToken');
export const ETHERSCAN_API_KEY = getEnvironmentVariable('etherscanApiKey');
export const ICY_TOOLS_API_KEY = getEnvironmentVariable('icyToolsApiKey');

export const TRACE_LOG = getEnvironmentVariable('TRACE_LOG', false) === 'true';
export const INFO_LOG = getEnvironmentVariable('INFO_LOG', false) === 'true';
export const ERROR_LOG = getEnvironmentVariable('ERROR_LOG', false) === 'true';
export const WARN_LOG = getEnvironmentVariable('WARN_LOG', false) === 'true';

/**
 * USE LIB firestoreConstants instead of this
 */
const fstr = {
  ROOT_COLL: TEST_ROOT,
  OPENSEA_COLL: 'combinedOpenseaSnapshot',
  INFO_DOC: 'info',
  COLLECTION_LISTINGS_COLL: 'collectionListings',
  COLLECTIONS_COLL: 'collections',
  BONUS_REWARD_TOKENS_COLL: 'bonusRewardTokens',
  USERS_COLL: 'users',
  LISTINGS_COLL: 'listings',
  STALE_LISTINGS_COLL: 'staleListings',
  OFFERS_COLL: 'offers',
  ASSETS_COLL: 'assets',
  PURCHASES_COLL: 'purchases',
  SALES_COLL: 'sales',
  TXNS_COLL: 'txns',
  MISSED_TXNS_COLL: 'missedTxns',
  FEATURED_COLL: 'featuredCollections',
  TWITTER_COLL: 'twitter',
  TWEETS_COLL: 'tweets',
  MENTIONS_COLL: 'mentions',
  HISTORICAL_COLL: 'historical',
  VOTES_COLL: 'votes',
  COLLECTION_STATS_COLL: 'stats',
  COLLECTION_LINKS_DOC: 'links',
  COLLECTION_OPENSEA_STATS_DOC: 'opensea',
  COLLECTION_DATA_COLL: 'data',
  // COLLECTION_SOCIALS_COLL: 'socials',
  COLLECTION_TWITTER_DOC: 'twitter',
  COLLECTION_DISCORD_DOC: 'discord',
  AUTH_COLL: 'auth',
  EDITORS_DOC: 'editors',
  CREATOR_DOC: 'creator',
  ADMINS_DOC: 'admins',
  COLLECTION_FOLLOWS_COLL: 'collectionFollows',
  USER_FOLLOWS_COLL: 'userFollows',
  SELL_ORDERS_COLL: 'sellOrders',
  BUY_ORDERS_COLL: 'buyOrders'
};

/**
 * Deprecate access to an object (i.e. logs the warning message anytime the object is accessed)
 *
 */
export function deprecateObject<T extends object>(obj: T, message: string): T {
  const handler = {
    get(target: T, prop: string) {
      warn(message);
      return Reflect.get(target, prop);
    }
  };

  return new Proxy(obj, handler);
}

export const fstrCnstnts = deprecateObject(
  fstr,
  'fstrCnstnts is deprecated, prefer to use firestoreConstants from @infinityxyz/lib'
);

export const auth = {
  signature: 'x-auth-signature',
  message: 'x-auth-message'
};

export const API_BASE = 'http://localhost:9090';
export const SITE_BASE = 'http://localhost:3000';

export const SALE_FEES_TO_PURCHASE_FEES_RATIO = 5;

// todo: remove these
export const POLYGON_WYVERN_EXCHANGE_ADDRESS = '0xbfbf0bd8963fe4f5168745ad59da20bf78d6385e';
export const WYVERN_EXCHANGE_ADDRESS = '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b';
export const WYVERN_ATOMIC_MATCH_FUNCTION = 'atomicMatch_';
export const WYVERN_CANCEL_ORDER_FUNCTION = 'cancelOrder_';
export const NFTC_FEE_ADDRESS = '0xAAdd54c429a6eEBD4514135EaD53d98D0Cc57d57';

export const FEATURED_LIMIT = 4; // Number of featured collections

export const OPENSEA_API = 'https://api.opensea.io/api/v1/';

export const DEFAULT_MIN_ETH = 0.0000001;
export const DEFAULT_MAX_ETH = 1000000; // For listings
export const DEFAULT_PRICE_SORT_DIRECTION = OrderDirection.Descending;

export const INFINITY_EMAIL = 'hi@infinity.xyz';
export const FB_STORAGE_BUCKET = 'nftc-dev.appspot.com';
export const FIREBASE_SERVICE_ACCOUNT = 'nftc-dev-firebase-creds.json';
export const ORIGIN = /http:\/\/localhost:\d+/;
export const INFINITY_URL = 'https://infinity.xyz/';

export const ONE_HOUR = 3_600_000; // In ms
export const ONE_DAY = ONE_HOUR * 24;
export const MIN_TWITTER_UPDATE_INTERVAL = ONE_HOUR; // In ms
export const MIN_DISCORD_UPDATE_INTERVAL = ONE_HOUR;
export const MIN_LINK_UPDATE_INTERVAL = ONE_HOUR;
export const MIN_COLLECTION_STATS_UPDATE_INTERVAL = ONE_HOUR / 4; // 15 min
