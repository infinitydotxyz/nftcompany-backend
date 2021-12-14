import { RawTrait } from '@base/types/OSNftInterface';
import { CovalentPagination } from './CovalentPagination';

export interface CovalentData {
  /**
   * ISO string date
   */
  updated_at: string;
  /**
   * resulting items
   */
  items: CovalentNFTMetadata[];

  pagination?: CovalentPagination;
}

export interface CovalentNFTMetadata {
  contract_decimals: number;
  contract_name: string;
  contract_ticker_symbol: string;
  contract_address: string;
  supports_erc: string[];
  logo_url: string;
  last_transferred_at?: any;
  type: string;
  balance?: any;
  balance_24h?: any;
  quote_rate?: any;
  quote_rate_24h?: any;
  quote?: any;
  quote_24h?: any;
  nft_data: NFTMetadata[];
}

interface NFTMetadata {
  token_id: string;
  token_balance: string;
  token_url: string;
  supports_erc: string[];
  token_price_wei?: any;
  token_quote_rate_eth?: any;
  original_owner: string;
  external_data: ExternalData;
  owner: string;
  owner_address: string;
  burned: boolean;
}

interface ExternalData {
  name?: string;
  description?: string;
  image?: string;
  image_256?: string;
  image_512?: string;
  image_1024?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: RawTrait[];
  owner?: unknown;
}
