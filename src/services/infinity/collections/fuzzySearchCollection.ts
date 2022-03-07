import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { getEndCode, getSearchFriendlyString } from 'utils/formatters';

export async function fuzzySearchCollection(startsWithQuery: string, limit: number) {
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
