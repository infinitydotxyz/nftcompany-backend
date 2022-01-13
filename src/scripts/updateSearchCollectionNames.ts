/**
 *
 * iterates through collection in the ALL_COLLECTIONS collection
 * gets searchCollectionNames from listings (20)
 * makes sure it only received one searchCollectionName from all listings (20)
 * updates the collection info the ALL_COLLECTIONS collection with the
 * searchCollectionName found
 *
 * listings are assummed to be the single source of truth
 *
 */

import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { sleep } from '@utils/index';

/**
 *
 * delay in ms after updating a collection, in-case you want to double check
 * changes as the script updates
 */
export async function updateSearchCollectionName(delay: number) {
  const allCollectionsQuery = await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).get();
  let collectionsUpdated = 0;

  for (const collectionDoc of allCollectionsQuery.docs) {
    const collection = collectionDoc.data();
    const collectionAddress = collection?.address?.trim()?.toLowerCase();
    const searchCollectionName = collection?.searchCollectionName;

    if (!searchCollectionName && !collectionAddress) {
      console.log(
        `Undefined search collection name and undefined collection address. Doc Path: ${collectionDoc.ref.path}`
      );
      continue;
    }

    console.group(searchCollectionName);
    if (collectionAddress) {
      const listingSearchCollectionNames = await getCollectionNamesFromListings(
        collectionAddress,
        searchCollectionName
      );

      if (listingSearchCollectionNames.length > 0) {
        console.log(
          `Found ${listingSearchCollectionNames.length} differing names: ${listingSearchCollectionNames.join(`\n\t`)}`
        );
        const updatedSearchCollectionName = listingSearchCollectionNames?.[0] ?? '';

        if (listingSearchCollectionNames.length === 1 && updatedSearchCollectionName) {
          /**
           * update collection info
           */
          try {
            await collectionDoc.ref.update('searchCollectionName', updatedSearchCollectionName);
          } catch (err) {
            console.error(err);
            throw new Error(`Failed to update collection: ${collectionAddress}`);
          }

          console.log(`Updated: ${collectionAddress} from ${searchCollectionName} to ${updatedSearchCollectionName}`);
          collectionsUpdated += 1;
        } else {
          console.error(`Failed to resolve search collection name for: ${collectionAddress}`);
          console.log(listingSearchCollectionNames);
        }
      }
    }
    console.groupEnd();
    await sleep(delay);
  }

  console.log(`Updated: ${collectionsUpdated} collections`);
}

async function getCollectionNamesFromListings(collectionAddress: string, collectionInfoSearchCollectionName: string) {
  const collectionListingsQuery = await firestore.db
    .collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .where('metadata.asset.address', '==', collectionAddress)
    .limit(20)
    .get();

  const collectionListings = collectionListingsQuery.docs.map((item) => item.data());
  const searchCollectionNames: string[] = [];
  for (const listing of collectionListings) {
    const listingSearchCollectionName = listing?.metadata?.asset?.searchCollectionName ?? '';
    if (listingSearchCollectionName !== collectionInfoSearchCollectionName) {
      searchCollectionNames.push(listingSearchCollectionName);
    }
  }

  const searchCollectionNamesWithoutDups = [...new Set(searchCollectionNames)];

  return [...searchCollectionNamesWithoutDups];
}
