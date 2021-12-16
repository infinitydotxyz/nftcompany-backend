import { Order } from './Order';

export interface InfinityOrderData {
  title: string;
  tokenAddress: string;
  tokenId: string;
  /**
   * 1 if from opensea
   */
  source?: number;
  name?: string;
  description?: string;
  image?: string;
  cardImage?: string;
  imagePreview?: string;
  price?: number;
  inStock?: number;
  order?: Order;
  collectionName?: string;
  maker?: string;
  hasBonusReward?: boolean;
  hasBlueCheck?: boolean;
  owner?: string;
  schemaName?: string;
  expirationTime?: string;
  chainId?: string;
}
