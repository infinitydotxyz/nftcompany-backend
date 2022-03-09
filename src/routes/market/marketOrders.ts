import { singleton, container } from 'tsyringe';

@singleton()
export class MarketOrders {
  duh = () => {
    console.log('wat?');
  };
}

// singleton
export const marketOrders: MarketOrders = container.resolve(MarketOrders);

export interface BuyOrder {
  user: string;
  expiration: string;
  collections: string[];
  minNFTs: number;
  budget: number;
}

export interface SellOrder {
  nftAddress: string;
  expiration: string;
  collection: string;
  price: number;
}

// ==================================================
// notes:
//
// orders stored per user or globally?
//
