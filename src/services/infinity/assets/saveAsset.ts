import { firestore } from 'container';
import { CovalentWalletBalanceItem } from '@infinityxyz/lib/types/services/covalent';
import { covalentAssetDataToListing } from 'services/covalent/utils';
import { error, firestoreConstants, getDocIdHash } from '@infinityxyz/lib/utils';
import { getAssetAsListing } from '../utils';

export async function saveRawCovalentAssetInDatabase(chainId: string, nftMetadata: CovalentWalletBalanceItem) {
  try {
    const marshalledData = await covalentAssetDataToListing(chainId, nftMetadata);
    const assetData = {
      metadata: marshalledData,
      rawData: nftMetadata
    };

    const tokenAddress = marshalledData.asset.address.toLowerCase();
    const tokenId = marshalledData.asset.id;
    const newDoc = firestore
      .collection(firestoreConstants.ASSETS_COLL)
      .doc(getDocIdHash({ collectionAddress: tokenAddress, tokenId, chainId }));
    await newDoc.set(assetData);
    return getAssetAsListing(newDoc.id, assetData);
  } catch (err: any) {
    error('Error occured while saving asset data in database');
    error(err);
  }
}
