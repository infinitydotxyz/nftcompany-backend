import { CovalentWalletBalanceItem } from './CovalentNFTMetadata';
import { CovalentPagination } from './CovalentPagination';

export interface CovalentBalance {
  address: string;
  updated_at: string;
  next_update_at: string;
  quote_currency: string;
  chain_id: number;
  items: CovalentWalletBalanceItem[];
  pagination?: CovalentPagination;
}
