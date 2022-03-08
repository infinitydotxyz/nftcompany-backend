import { OrderDirection } from '@infinityxyz/lib/types/core';

const getEnvironmentVariable = (name: string, required = true) => {
  const variable = process.env[name];
  if (required && !variable) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return variable;
};

export const TEST_ROOT = getEnvironmentVariable('firestoreTestRoot', false) ?? 'testRoot';
export const COVALENT_API_KEY = getEnvironmentVariable('covalentKey') as string;
export const UNMARSHALL_API_KEY = getEnvironmentVariable('unmarshalKey') as string;
export const ALCHEMY_JSON_RPC_ETH_MAINNET = getEnvironmentVariable('alchemyJsonRpcEthMainnet') as string;
export const ALCHEMY_NFT_BASE_URL_ETH_MAINNET = getEnvironmentVariable('alchemyNftAPiBaseUrlEth') as string;
export const ALCHEMY_NFT_BASE_URL_POLYGON_MAINNET = getEnvironmentVariable('alchemyNftAPiBaseUrlPolygon') as string;
export const OPENSEA_API_KEY = getEnvironmentVariable('openseaKey') as string;
export const TWITTER_BEARER_TOKEN = getEnvironmentVariable('twitterBearerToken') as string;
export const ETHERSCAN_API_KEY = getEnvironmentVariable('etherscanApiKey') as string;
export const ICY_TOOLS_API_KEY = getEnvironmentVariable('icyToolsApiKey') as string;

export const TRACE_LOG = getEnvironmentVariable('TRACE_LOG', false) === 'true';
export const INFO_LOG = getEnvironmentVariable('INFO_LOG', false) === 'true';
export const ERROR_LOG = getEnvironmentVariable('ERROR_LOG', false) === 'true';
export const WARN_LOG = getEnvironmentVariable('WARN_LOG', false) === 'true';

export const fstrCnstnts = {
  ROOT_COLL: TEST_ROOT,
  OPENSEA_COLL: 'combinedOpenseaSnapshot',
  INFO_DOC: 'info',
  COLLECTION_LISTINGS_COLL: 'collectionListings',
  ALL_COLLECTIONS_COLL: 'allCollections',
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
  COLLECTION_SOCIALS_COLL: 'socials',
  COLLECTION_TWITTER_DOC: 'twitter',
  COLLECTION_DISCORD_DOC: 'discord',
  AUTH_COLL: 'auth',
  EDITORS_DOC: 'editors',
  CREATOR_DOC: 'creator',
  ADMINS_DOC: 'admins',

  COLLECTION_FOLLOWS_COLL: 'collectionFollows',
  USER_FOLLOWS_COLL: 'userFollows'
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
export const FB_STORAGE_BUCKET = 'nftc-dev.appspot.com';
export const ORIGIN = /http:\/\/localhost:\d+/;

export const ONE_HOUR = 3_600_000; // in ms
export const ONE_DAY = ONE_HOUR * 24;
export const MIN_TWITTER_UPDATE_INTERVAL = ONE_HOUR; // in ms
export const MIN_DISCORD_UPDATE_INTERVAL = ONE_HOUR;
export const MIN_LINK_UPDATE_INTERVAL = ONE_HOUR;
export const MIN_COLLECTION_STATS_UPDATE_INTERVAL = ONE_HOUR / 4; // 15 min

export const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
export const POLYGON_WETH_ADDRESS = '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619';
