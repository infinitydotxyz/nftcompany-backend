import { Listing } from './Listing';

/**
 * @typedef { import("./Listing").Listing} Listing
 */

/**
 * @typedef {Object} ListingResponse
 * @property {number} count
 * @property {Listing[]} listings
 */
export interface ListingResponse {
  count: number;
  listings: Listing[];
}
