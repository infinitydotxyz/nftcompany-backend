import { SetMetadata } from '@nestjs/common';

export const metadataKey = 'params';

/**
 * Verify that the specified addresses in the url query parameters match the signing address (i.e the wallet that's currently authenticated).
 *
 * @example
 *
 * You have a URL like `http://localhost:3030/1:0x123456789/watchlist` that returns the user's NFT collection watchlist.
 * In order to verify that the user that's requesting this resource is the owner of the account int the URL, your code would (minimally) look like this:
 * ```
 * \@Get(':userId/watchlist')
 * \@ApiSignatureAuth()
 * \@UseGuards(new AuthGuard())
 * \@MatchSigner('userId')
 * async getWatchlist()
 * ```
 *
 * In this example, `AuthGuard` will know to look for the `userId` in the query params and check if it matches the signing address.
 *
 * You can also specify multiple params to validate, if necessary.
 * @param params Names of the url query parameters.
 * @returns
 */
export const MatchSigner = (...params: string[]) => SetMetadata(metadataKey, params);
