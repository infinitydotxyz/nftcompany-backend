import { WyvernTrait } from '@base/types/WyvernOrder';
import { CovalentPagination } from './CovalentPagination';

export interface CovalentNftMetadata {
  /**
   * ISO string date
   */
  updated_at: string;
  /**
   * resulting items
   */
  items: CovalentWalletBalanceItem[];

  pagination?: CovalentPagination;
}

export interface CovalentWalletBalanceItem {
  contract_decimals: number;
  contract_name: string;
  contract_ticker_symbol: string;
  contract_address: string;
  supports_erc: string[];
  logo_url: string;
  last_transferred_at?: string;
  type: string;
  balance?: number;
  balance_24h?: number;
  quote_rate?: number;
  quote_rate_24h?: number;
  quote?: number;
  quote_24h?: number;
  nft_data: CovalentNftMetadataWithOwner[];
}

interface CovalentNftMetadataWithOwner {
  token_id: string;
  token_balance: string;
  token_url: string;
  supports_erc: string[];
  token_price_wei?: number;
  token_quote_rate_eth?: number;
  original_owner: string;
  external_data: CovalentExternalNftMetadata;
  owner: string;
  owner_address?: string;
  burned: boolean;
}

interface CovalentExternalNftMetadata {
  name?: string;
  description?: string;
  image?: string;
  image_256?: string;
  image_512?: string;
  image_1024?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: WyvernTrait[];
  owner?: string;
}
