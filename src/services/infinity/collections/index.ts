import { firestore } from '@base/container';
import { CollectionInfo } from '@base/types/NftInterface';
import { RawTraitWithValues } from '@base/types/OSNftInterface';
import { fstrCnstnts } from '@constants';
import { getEndCode, getSearchFriendlyString } from '@utils/formatters';
import { ethers } from 'ethers';

export async function saveCollectionTraits(contractAddress: string, traits: RawTraitWithValues[]) {
  if (!ethers.utils.isAddress(contractAddress)) {
    return { success: false, error: new Error('invalid address') };
  }
  try {
    await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(contractAddress).set({ traits }, { merge: true });
    return { success: true };
  } catch (err) {
    return {
      successs: false,
      error: err
    };
  }
}

export async function getCollectionInfoByName(searchCollectionName: string, limit: number) {
  try {
    const res = await firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .where('searchCollectionName', '==', searchCollectionName)
      .limit(limit)
      .get();
    const data: CollectionInfo[] = res.docs.map((doc) => {
      return doc.data() as CollectionInfo;
    });

    return {
      success: true,
      data
    };
  } catch (err) {
    return {
      success: false,
      error: err
    };
  }
}

export async function collectionQuery(startsWithQuery: string, limit: number) {
  const startsWith = getSearchFriendlyString(startsWithQuery);
  try {
    if (!startsWith) {
      return {
        success: true,
        data: []
      };
    }
    if (startsWith && typeof startsWith === 'string') {
      const endCode = getEndCode(startsWith);
      const docsData = await firestore.db
        .collectionGroup(fstrCnstnts.LISTINGS_COLL)
        .where('metadata.asset.searchCollectionName', '>=', startsWith)
        .where('metadata.asset.searchCollectionName', '<', endCode)
        .orderBy('metadata.asset.searchCollectionName')
        .select('metadata.asset.address', 'metadata.asset.collectionName', 'metadata.hasBlueCheck')
        .limit(limit)
        .get();
      const data = docsData.docs.map((doc) => {
        const docData = doc.data();
        return {
          address: docData.metadata.asset.address as string,
          collectionName: docData.metadata.asset.collectionName as string,
          hasBlueCheck: docData.metadata.hasBlueCheck as boolean
        };
      });

      return {
        success: true,
        data
      };
    }
    return {
      success: false,
      error: new Error('invalid query')
    };
  } catch (err) {
    return {
      success: false,
      error: err
    };
  }
}
