/**
 * @typedef {Object} WyvernAssetData
 * @property {AssetContract} asset_contract
 * @property {string} token_id
 * @property {WyvernUser} creator
 * @property {number} id
 * @property {string} listing_date
 * @property {number} num_sales
 * @property {string} transfer_fee_payment_token
 * @property {WyvernCollection} collection
 * @property {string} permalink
 * @property {boolean} is_presale
 * @property {string} description
 * @property {string} external_link
 * @property {string} name
 * @property {string} image_preview_url
 * @property {string} top_bid
 * @property {string} animation_url
 * @property {number} decimals
 * @property {number} transfer_fee
 * @property {WyvernUser} owner
 * @property {string} token_metadata
 * @property {string} background_color
 * @property {string} animation_original_url
 * @property {LastSale} last_sale
 * @property {string} image_url
 * @property {WyvernTrait[]} traits
 * @property {string} image_thumbnail_url
 * @property {WyvernSellOrder[]} sell_orders
 * @property {string} image_original_url
 */
export interface WyvernAssetData {
  asset_contract: AssetContract;
  token_id: string;
  creator: WyvernUser;
  id: number;
  listing_date?: any;
  num_sales: number;
  transfer_fee_payment_token?: any;
  collection: WyvernCollection;
  permalink: string;
  is_presale: boolean;
  description: string;
  external_link?: any;
  name: string;
  image_preview_url: string;
  top_bid?: any;
  animation_url?: any;
  decimals: number;
  transfer_fee?: any;
  owner: WyvernUser;
  token_metadata: string;
  background_color?: any;
  animation_original_url?: any;
  last_sale: LastSale;
  image_url: string;
  traits: WyvernTrait[];
  image_thumbnail_url: string;
  sell_orders: WyvernSellOrder[];
  image_original_url: string;
}

/**
 * @typedef {Object} WyvernSellOrder
 * @property {string} payment_token
 * @property {string} target
 * @property {string} bounty_multiple
 * @property {number} side
 * @property {string} current_price
 * @property {number} listing_time
 * @property {string} calldata
 * @property {string} current_bounty
 * @property {number} expiration_time
 * @property {string} maker_protocol_fee
 * @property {PaymentTokenContract} payment_token_contract
 * @property {string} created_date
 * @property {boolean} finalized
 * @property {string} static_extradata
 * @property {string} order_hash
 * @property {string} salt
 * @property {number} fee_method
 * @property {string} r
 * @property {string} extra
 * @property {string} closing_date
 * @property {number} v
 * @property {string} taker_protocol_fee
 * @property {string} exchange
 * @property {string} replacement_pattern
 * @property {string} quantity
 * @property {string} maker_referrer_fee
 * @property {{schema: string, asset: {address: string, id: string }}} metadata
 * @property {string} prefixed_hash
 * @property {string} static_target
 * @property {number} sale_kind
 * @property {boolean} closing_extendable
 * @property {MarketMaker} maker
 * @property {boolean} approved_on_chain
 * @property {boolean} marked_invalid
 * @property {number} how_to_call
 * @property {string} base_price
 * @property {MarketMaker} taker
 * @property {MarketMaker} fee_recipient
 * @property {string} s
 * @property {string} maker_relayer_fee
 * @property {boolean} cancelled
 * @property {string} taker_relayer_fee
 */
export interface WyvernSellOrder {
  payment_token: string;
  target: string;
  bounty_multiple: string;
  side: number;
  current_price: string;
  listing_time: number;
  calldata: string;
  current_bounty: string;
  expiration_time: number;
  maker_protocol_fee: string;
  payment_token_contract: PaymentTokenContract;
  created_date: string;
  finalized: boolean;
  static_extradata: string;
  order_hash: string;
  salt: string;
  fee_method: number;
  r: string;
  extra: string;
  closing_date: string;
  v: number;
  taker_protocol_fee: string;
  exchange: string;
  replacement_pattern: string;
  quantity: string;
  maker_referrer_fee: string;
  metadata: {
    schema: string;
    asset: {
      address: string;
      id: string;
    };
  };
  prefixed_hash: string;
  static_target: string;
  sale_kind: number;
  closing_extendable: boolean;
  maker: MarketMaker;
  approved_on_chain: boolean;
  marked_invalid: boolean;
  how_to_call: number;
  base_price: string;
  taker: MarketMaker;
  fee_recipient: MarketMaker;
  s: string;
  maker_relayer_fee: string;
  cancelled: boolean;
  taker_relayer_fee: string;
}

/**
 * @typedef {Object} LastSale
 * @property {string} event_type
 * @property {{token_id: string, decimals: number}} asset
 * @property {string} created_date
 * @property {Transaction} transaction
 * @property {PaymentTokenContract} payment_token
 * @property {*} [auction_type]
 * @property {*} [asset_bundle]
 * @property {string} quantity
 * @property {string} event_timestamp
 * @property {string} total_price
 */
export interface LastSale {
  event_type: string;
  asset: {
    token_id: string;
    decimals: number;
  };
  created_date: string;
  transaction: Transaction;
  payment_token: PaymentTokenContract;
  auction_type?: any;
  asset_bundle?: any;
  quantity: string;
  event_timestamp: string;
  total_price: string;
}

/**
 * @typedef {Object} Transaction
 * @property {WyvernUser} to_account
 * @property {string} transaction_hash
 * @property {string} block_number
 * @property {string} block_hash
 * @property {number} id
 * @property {string} timestamp
 * @property {WyvernUser} from_account
 * @property {string} transaction_index
 */
export interface Transaction {
  to_account: WyvernUser;
  transaction_hash: string;
  block_number: string;
  block_hash: string;
  id: number;
  timestamp: string;
  from_account: WyvernUser;
  transaction_index: string;
}

/**
 * @typedef {Object} MarketMaker
 * @property {string} profile_img_url
 * @property {number} user
 * @property {string} config
 * @property {string} address
 */
export interface MarketMaker {
  profile_img_url: string;
  user: number;
  config: string;
  address: string;
}

/**
 * @typedef {Object} PaymentTokenContract
 * @property {string} name
 * @property {string} address
 * @property {string} usd_price
 * @property {string} symbol
 * @property {string} image_url
 * @property {string} eth_price
 * @property {number} decimals
 * @property {number} id
 */
export interface PaymentTokenContract {
  name: string;
  address: string;
  usd_price: string;
  symbol: string;
  image_url: string;
  eth_price: string;
  decimals: number;
  id: number;
}

/**
 * @typedef {Obect} WyvernUser
 * @property {{username: string}} user
 * @property {string} username
 * @property {string} config
 * @property {string} address
 * @property {string} profile_img_url
 */
export interface WyvernUser {
  user: {
    username: string;
  };
  config: string;
  address: string;
  profile_img_url: string;
}

/**
 * @typedef {Object} WyvernTrait
 * @property {string} trait_type
 * @property {number} trait_count
 * @property {*} [display_type]
 * @property {string} value
 * @property {*} [order]
 * @property {*} [max_value]
 */
export interface WyvernTrait {
  trait_type: string;
  trait_count: number;
  display_type?: any;
  value: string;
  max_value?: any;
}

/**
 * @typedef {Object} Basic
 * @property {string} traitType
 */

/**
 * @typedef {Object} WyvernTraitWithValues
 * @property {string} trait_type
 * @property {number} trait_count
 * @property {string} display_type
 * @property {string} values
 * @property {string} max_value
 */
export interface WyvernTraitWithValues {
  trait_type: string;
  trait_count: number;
  display_type?: string;
  values: string[];
  max_value?: any;
}

/**
 * @typedef {Object} WyvernCollection
 * @property {string} [instagram_username]
 * @property {string} large_image_url
 * @property {boolean} default_to_fiat
 * @property {boolean} only_proxied_transfers
 * @property {boolean} hidden
 * @property {string} description
 * @property {string} opensea_buyer_fee_basis_points
 * @property {string} [short_description]
 * @property {string} created_date
 * @property {*} [wiki_url]
 * @property {boolean} require_email
 * @property {*} [medium_username]
 * @property {string} image_url
 * @property {DisplayData} display_data
 * @property {string} discord_url
 * @property {string} twitter_username
 * @property {string} featured_image_url
 * @property {string} dev_seller_fee_basis_points
 * @property {string} dev_buyer_fee_basis_points
 * @property {string} external_url
 * @property {string} opensea_seller_fee_basis_points
 * @property {string} banner_image_url
 * @property {string} payout_address
 * @property {boolean} is_subject_to_whitelist
 * @property {*} [telegram_url]
 * @property {string} safelist_request_status
 * @property {*} [chat_url]
 * @property {string} name
 * @property {boolean} featured
 * @property {string} slug
 */
export interface WyvernCollection {
  instagram_username?: string;
  large_image_url: string;
  default_to_fiat: boolean;
  only_proxied_transfers: boolean;
  hidden: boolean;
  description: string;
  opensea_buyer_fee_basis_points: string;
  short_description?: string;
  created_date: string;
  wiki_url?: any;
  require_email: boolean;
  medium_username?: any;
  image_url: string;
  display_data: DisplayData;
  discord_url: string;
  twitter_username: string;
  featured_image_url: string;
  dev_seller_fee_basis_points: string;
  dev_buyer_fee_basis_points: string;
  external_url: string;
  opensea_seller_fee_basis_points: string;
  banner_image_url: string;
  payout_address: string;
  is_subject_to_whitelist: boolean;
  telegram_url?: any;
  safelist_request_status: string;
  chat_url?: any;
  name: string;
  featured: boolean;
  slug: string;
}

/**
 * @typedef DisplayData
 * @property {string} card_display_style
 */
interface DisplayData {
  card_display_style: string;
}

/**
 * @typedef {Object} AssetContract
 * @property {string} [opensea_version]
 * @property {string} created_date
 * @property {string} name
 * @property {string} external_link
 * @property {string} description
 * @property {number} opensea_seller_fee_basis_points
 * @property {string} schema_name
 * @property {boolean} only_proxied_transfers
 * @property {string} address
 * @property {string} symbol
 * @property {number} seller_fee_basis_points
 * @property {string} nft_version
 * @property {number} dev_seller_fee_basis_points
 * @property {string} asset_contract_type
 * @property {string} payout_address
 * @property {number} buyer_fee_basis_points
 * @property {number} owner
 * @property {string} total_supply
 * @property {string} image_url
 * @property {boolean} default_to_fiat
 * @property {number} dev_buyer_fee_basis_points
 * @property {number} opensea_buyer_fee_basis_points
 */
export interface AssetContract {
  opensea_version?: any;
  created_date: string;
  name: string;
  external_link: string;
  description: string;
  opensea_seller_fee_basis_points: number;
  schema_name: string;
  only_proxied_transfers: boolean;
  address: string;
  symbol: string;
  seller_fee_basis_points: number;
  nft_version: string;
  dev_seller_fee_basis_points: number;
  asset_contract_type: string;
  payout_address: string;
  buyer_fee_basis_points: number;
  owner: number;
  total_supply: string;
  image_url: string;
  default_to_fiat: boolean;
  dev_buyer_fee_basis_points: number;
  opensea_buyer_fee_basis_points: number;
}
