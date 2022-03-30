import { FeedEventType } from '@infinityxyz/lib/types/core/feed';

export enum ActivityType {
  Sale = 'sale'
  // Listing = 'listing'
  // Offer = 'offer'
}

export const activityTypeToEventType = {
  [ActivityType.Sale]: FeedEventType.NftSale
};
