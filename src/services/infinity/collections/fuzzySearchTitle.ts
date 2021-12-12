import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { getEndCode, getSearchFriendlyString } from '@utils/formatters';

export async function fuzzySearchTitle(startsWithOrig: string, limit: number) {
  const startsWith = getSearchFriendlyString(startsWithOrig as string);
  if (startsWith && typeof startsWith === 'string') {
    const endCode = getEndCode(startsWith);
    const data = await firestore.db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchTitle', '>=', startsWith)
      .where('metadata.asset.searchTitle', '<', endCode)
      .orderBy('metadata.asset.searchTitle')
      .select('metadata.asset.title', 'metadata.asset.address', 'metadata.asset.id')
      .limit(limit)
      .get();

    const result = data.docs.map((doc) => {
      return {
        title: doc.data().metadata.asset.title,
        id: doc.data().metadata.asset.id,
        address: doc.data().metadata.asset.address
      };
    });

    return result;
  }

  return [];
}
