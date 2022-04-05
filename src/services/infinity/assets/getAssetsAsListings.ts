import { firestore } from 'container';
import { getAssetFromCovalent } from 'services/covalent/getAssetFromCovalent';
import { getAssetFromOpensea } from 'services/opensea/assets/getAssetFromOpensea';
import { error, log, jsonString, getDocIdHash, firestoreConstants } from '@infinityxyz/lib/utils';
import { getAssetAsListing } from '../utils';
import { getERC721Owner } from 'services/ethereum/checkOwnershipChange';

export async function fetchAssetAsListingFromDb(
  chainId: string,
  tokenId: string,
  tokenAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _limit: number
) {
  log('Getting asset as listing from db');
  try {
    const docId = getDocIdHash({ chainId, tokenId, collectionAddress: tokenAddress });
    const doc = await firestore.collection(firestoreConstants.ASSETS_COLL).doc(docId).get();

    let listings;

    if (!doc.exists) {
      if (chainId === '1') {
        // Get from opensea
        listings = await getAssetFromOpensea(chainId, tokenId, tokenAddress);
      } else if (chainId === '137') {
        // Get from covalent
        listings = await getAssetFromCovalent(chainId, tokenId, tokenAddress);
      }
    } else {
      const order = doc.data();

      try {
        const schema = order?.metadata?.schema;
        if (order && schema === 'ERC721') {
          /**
           * Check ownership change
           * update if necessary
           */
          const savedOwner = order?.metadata?.asset?.owner ?? '';
          const owner = await getERC721Owner(tokenAddress, tokenId, chainId);
          if (owner && owner !== savedOwner) {
            order.metadata.asset.owner = owner;
            doc.ref.update({ 'metadata.asset.owner': owner }).catch(() => {
              return;
            });
          }
        }
      } catch (err) {}

      listings = getAssetAsListing(docId, order);
    }
    return jsonString(listings);
  } catch (err) {
    error('Failed to get asset from db', tokenAddress, tokenId);
    error(err);
  }
}
