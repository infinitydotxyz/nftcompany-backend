export interface RawAssetData {
  asset_contract: AssetContract;
  token_id: string;
  creator: OpenseaUser;
  id: number;
  listing_date?: any;
  num_sales: number;
  transfer_fee_payment_token?: any;
  collection: RawCollection;
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
  owner: OpenseaUser;
  token_metadata: string;
  background_color?: any;
  animation_original_url?: any;
  last_sale: LastSale;
  image_url: string;
  traits: RawTrait[];
  image_thumbnail_url: string;
  sell_orders: RawSellOrder[];
  image_original_url: string;
}

export interface RawSellOrder {
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

export interface Transaction {
  to_account: OpenseaUser;
  transaction_hash: string;
  block_number: string;
  block_hash: string;
  id: number;
  timestamp: string;
  from_account: OpenseaUser;
  transaction_index: string;
}

export interface MarketMaker {
  profile_img_url: string;
  user: number;
  config: string;
  address: string;
}

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

export interface OpenseaUser {
  user: {
    username: string;
  };
  config: string;
  address: string;
  profile_img_url: string;
}

export interface RawTrait {
  trait_type: string;
  trait_count: number;
  display_type?: any;
  value: string;
  order?: any;
  max_value?: any;
}

export interface RawCollection {
  instagram_username?: any;
  large_image_url: string;
  default_to_fiat: boolean;
  only_proxied_transfers: boolean;
  hidden: boolean;
  description: string;
  opensea_buyer_fee_basis_points: string;
  short_description?: any;
  created_date: string;
  wiki_url?: any;
  require_email: boolean;
  medium_username?: any;
  image_url: string;
  display_data: {
    card_display_style: string;
  };
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
