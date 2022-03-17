import { Twitter } from 'services/twitter/Twitter';
import { InfinityTwitterAccount } from '@infinityxyz/lib/types/services/twitter';
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import { firestore } from 'container';
import { MIN_DISCORD_UPDATE_INTERVAL, MIN_TWITTER_UPDATE_INTERVAL, ONE_DAY } from '../../constants';
import {
  CollectionInfo,
  DiscordSnippet,
  TwitterSnippet,
  CollectionData,
  UpdateCollectionDataRequest,
  Keys,
  Links,
  WithTimestamp,
  StatusCode,
  Collection
} from '@infinityxyz/lib/types/core';
import { getWeekNumber } from 'utils';
import { aggregateHistoricalData, averageHistoricalData } from '../../services/infinity/aggregateHistoricalData';
import { DiscordAPI } from 'services/discord/DiscordAPI';
import { CollectionAuthType } from 'middleware/auth';
import { UploadedFile } from 'express-fileupload';
import { error, firestoreConstants, jsonString, log, trimLowerCase, getCollectionDocId } from '@infinityxyz/lib/utils';

interface FollowerData {
  followersCount: number;
  timestamp: number;
}

type FollowerDataAverages = Record<Keys<Omit<FollowerData, 'timestamp'>>, number>;

interface AggregatedFollowerData {
  weekStart: FollowerData;
  weekEnd: FollowerData;
  timestamp: number;
  averages: FollowerDataAverages;
}

type DiscordDataAverages = Record<Keys<Omit<DiscordSnippet, 'timestamp'>>, number>;
interface AggregatedDiscordData {
  weekStart: DiscordSnippet;
  weekEnd: DiscordSnippet;
  timestamp: number;
  averages: DiscordDataAverages;
}
interface DiscordHistoricalData {
  timestamp: number;
  presenceCount: number;
  membersCount: number;
}

interface TwitterHistoricalData {
  timestamp: number;
  followers: number;
}

/**
 * getCollectionInfo handles a request for collection info by slug or collection address
 */
export async function getCollectionInfo(req: Request<{ slug: string; chainId: string }>, res: Response) {
  const slugOrAddress = req.params.slug;
  let chainId = req.params.chainId;

  if (!chainId) {
    chainId = '1';
  }

  try {
    log('Fetching collection info for', slugOrAddress);

    let collectionInfo: CollectionInfo | undefined;
    /**
     * get base collection info
     */
    if (ethers.utils.isAddress(slugOrAddress)) {
      const address = trimLowerCase(slugOrAddress);

      collectionInfo = await getCollectionInfoByAddress({ chainId, address });
    } else {
      const data = await getCollectionInfoByName(slugOrAddress, 1);
      collectionInfo = data?.[0];
    }

    if (!collectionInfo?.name) {
      res.sendStatus(StatusCode.NotFound);
      return;
    }

    let collectionData: CollectionData | undefined;
    if (collectionInfo) {
      collectionData = await getCollectionDataFromCollectionInfo(collectionInfo);
    }

    const respStr = jsonString(collectionData ?? {});
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
    return;
  } catch (err) {
    error('Failed to get collection info for', slugOrAddress);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
}

/**
 * getCollectionInfo handles a request for collection info by slug or collection address
 */
export async function getCollectionInformationForEditor(
  req: Request<{ collection: string; user: string; chainId: string }>,
  res: Response<any, { authType: CollectionAuthType }>
) {
  const address = trimLowerCase(req.params.collection);
  const chainId = req.params.chainId;
  const editorType = res.locals.authType;
  const isCreator = editorType === CollectionAuthType.Creator;

  /**
   * this can be used for controlling permissions based on if the
   * user is a contract creator, editor or infinity admin
   */

  if (!ethers.utils.isAddress(address)) {
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    log('Fetching collection info for', address);

    /**
     * get base collection info
     */
    const collectionInfo = await getCollectionInfoByAddress({ chainId, address });
    let collectionData: CollectionData | undefined;
    if (collectionInfo) {
      collectionData = await getCollectionDataFromCollectionInfo(collectionInfo);
    }

    /**
     * creator clicked edit button for the first time
     */
    if (!collectionData?.isClaimed && isCreator) {
      const collectionDocId = `${chainId}:${address}`;
      const collectionInfoRef = firestore.collection(firestoreConstants.COLLECTIONS_COLL).doc(collectionDocId);
      await collectionInfoRef.set({ isClaimed: true }, { merge: true });
    }

    const respStr = jsonString(collectionData ?? {});
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
    return;
  } catch (err) {
    error('Failed to get collection info for', address);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
}

export async function postCollectionInformation(
  req: Request<{ collection: string; user: string; chainId: string }, any, { data: string }>,
  res: Response<any, { authType: CollectionAuthType }>
) {
  const chainId = req.params.chainId ?? '1';
  const collectionAddress = trimLowerCase(req.params.collection);
  // const editor = trimLowerCase(req.params.user);
  // const editorType = res.locals.authType;

  try {
    const data: UpdateCollectionDataRequest = JSON.parse(req.body.data);
    const profileImageFile: UploadedFile = req?.files?.profileImage as UploadedFile;
    let profileImageUpdate: { profileImage: string } = {} as any;
    /**
     * upload profile image to google cloud storage bucket
     */
    if (profileImageFile) {
      const hash = profileImageFile.md5;
      const fileExtension = profileImageFile.mimetype.split('/')?.[1];
      if (!fileExtension) {
        res.sendStatus(StatusCode.BadRequest);
        return;
      }
      const path = `images/collections/${collectionAddress}/${hash}.${fileExtension}`;
      const buffer = profileImageFile.data;

      const remoteFile = firestore.bucket.file(path);
      const existsArray = await remoteFile.exists();
      if (existsArray && existsArray.length > 0 && !existsArray[0]) {
        const remoteFile = await firestore.uploadBuffer(buffer, path, profileImageFile.mimetype);
        const publicUrl = remoteFile.publicUrl();
        if (publicUrl) {
          profileImageUpdate = {
            profileImage: publicUrl
          };
        }
      }
    } else if (data.profileImage.isDeleted) {
      profileImageUpdate = { profileImage: '' };
    }

    const collectionLinkUpdate: Links = {
      timestamp: Date.now(),
      twitter: data.twitter ?? '',
      discord: data.discord ?? '',
      external: data.external ?? '',
      medium: data.medium ?? '',
      telegram: data.telegram ?? '',
      instagram: data.instagram ?? '',
      wiki: data.wiki ?? '',
      facebook: data.facebook ?? ''
    };

    const collectionInfo: Pick<
      Collection['metadata'],
      'name' | 'description' | 'profileImage' | 'links' | 'benefits' | 'partnerships'
    > = {
      name: data.name ?? '',
      description: data.description ?? '',
      links: collectionLinkUpdate,
      benefits: data.benefits ?? [],
      partnerships: data.partnerships ?? [],
      ...profileImageUpdate
    };

    const docId = getCollectionDocId({ collectionAddress, chainId });
    const batch = firestore.db.batch();
    const collectionInfoRef = firestore.collection(firestoreConstants.COLLECTIONS_COLL).doc(docId);

    batch.set(collectionInfoRef, collectionInfo, { merge: true });

    await batch.commit();

    res.sendStatus(StatusCode.Created);

    const forceUpdate = true;
    /**
     * handles updating twitter data
     */
    getTwitterSnippet({ collectionAddress, chainId }, data.twitter, forceUpdate)
      .then(() => {
        log(`Updated twitter stats for new twitter link`);
      })
      .catch((err) => {
        error('Error occurred while updating twitter snippet');
        error(err);
      });

    /**
     * handles updating discord data
     */
    getDiscordSnippet({ collectionAddress, chainId }, data.discord, forceUpdate)
      .then(() => {
        log(`Updated discord stats for new discord link`);
      })
      .catch((err) => {
        error('Error occurred while updating discord snippet');
        error(err);
      });

    return;
  } catch (err) {
    error(`error occurred while updating collection info`);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
}

async function getCollectionDataFromCollectionInfo(collectionInfo: CollectionInfo) {
  const collectionData: CollectionData = {
    ...collectionInfo
  };
  const collection = {
    collectionAddress: collectionInfo.address,
    chainId: collectionInfo.chainId
  };

  const promises: Array<Promise<DiscordSnippet | TwitterSnippet | undefined>> = [];
  let discordSnippetPromise: Promise<DiscordSnippet | undefined>;
  if (collectionData?.links?.discord) {
    discordSnippetPromise = getDiscordSnippet(collection, collectionData.links.discord);
    promises.push(discordSnippetPromise);
  }

  let twitterSnippetPromise: Promise<TwitterSnippet | undefined>;
  if (collectionData?.links?.twitter) {
    twitterSnippetPromise = getTwitterSnippet(collection, collectionData.links.twitter);
    promises.push(twitterSnippetPromise);
  }
  /**
   * pulled/updated concurrently
   */
  const results = await Promise.all(promises);

  for (const result of results) {
    if (result && collectionData) {
      if ('membersCount' in result) {
        collectionData.discordSnippet = result;
      } else if (result) {
        collectionData.twitterSnippet = result;
      }
    }
  }

  return collectionData;
}

/**
 * getCollectionVotes is a proxy for getting votes for a collection
 *
 * **NOTE** votes should only be available to those that are authenticated, therefore requesting votes
 * for a collection is handled by the votes endpoint under the authenticated user path
 *
 * @param collectionAddress of the votes to get
 * @returns a promise of an object containing the number of votes for or against the collection
 */
export async function getCollectionVotes(collection: {
  collectionAddress: string;
  chainId: string;
}): Promise<{ votesFor: number; votesAgainst: number }> {
  const votes = await countVotes(collection);
  return votes;
}

async function countVotes(collection: { collectionAddress: string; chainId: string }) {
  const votesRef = firestore
    .collection(firestoreConstants.COLLECTIONS_COLL)
    .doc(getCollectionDocId(collection))
    .collection(firestoreConstants.VOTES_COLL);

  const stream = votesRef.stream();

  return await new Promise<{ votesFor: number; votesAgainst: number }>((resolve) => {
    let votesFor = 0;
    let votesAgainst = 0;
    stream.on('data', (snapshot) => {
      const data = snapshot.data();
      if (data.votedFor) {
        votesFor += 1;
      } else {
        votesAgainst += 1;
      }
    });

    stream.on('end', () => {
      resolve({ votesFor, votesAgainst });
    });
  });
}

/**
 * @param source of the data to get
 * @returns a request handler for querying historical data
 */
export function getHistoricalData(source: 'discord' | 'twitter') {
  return async (
    req: Request<
      { id: string; chainId: string },
      any,
      any,
      { from?: number; to?: number; interval?: 'hourly' | 'daily' | 'weekly'; startAt?: number }
    >,
    res: Response
  ) => {
    const interval = req.query.interval ?? 'hourly';
    const ONE_WEEK = ONE_DAY * 7;
    const address = trimLowerCase(req.params.id);
    const chainId = req.params.chainId;
    const collection = { collectionAddress: address, chainId };

    let to: number;
    let from: number;
    let startAt: number;
    const limit = 100;

    type Data = DiscordHistoricalData | TwitterHistoricalData;

    let historicalData: Array<Record<keyof Data, number>> = [];
    const FOUR_WEEKS = 4 * ONE_WEEK;
    const EIGHT_WEEKS = 8 * ONE_WEEK;
    const maxRange = EIGHT_WEEKS;
    try {
      switch (interval) {
        case 'hourly':
          from = Number(req.query.from ?? Date.now() - ONE_WEEK);
          startAt = Number(req.query.startAt ?? from);
          to = Number(req.query.to ?? from + ONE_WEEK);
          if (to - startAt > maxRange) {
            to = startAt + maxRange;
          }
          historicalData = await fetchHistoricalData<Data>(source, collection, startAt, to, limit, 'hourly');
          break;
        case 'daily':
          from = Number(req.query.from ?? Date.now() - FOUR_WEEKS);
          startAt = Number(req.query.startAt ?? from);
          to = Number(req.query.to ?? from + FOUR_WEEKS);
          if (to - startAt > maxRange) {
            to = startAt + maxRange;
          }
          historicalData = await fetchHistoricalData<Data>(source, collection, startAt, to, limit, 'daily');
          break;
        case 'weekly':
          from = Number(req.query.from ?? Date.now() - EIGHT_WEEKS);
          startAt = Number(req.query.startAt ?? from);
          to = Number(req.query.to ?? from + EIGHT_WEEKS);
          if (to - startAt > maxRange) {
            to = startAt + maxRange;
          }
          historicalData = await fetchHistoricalData<Data>(source, collection, startAt, to, limit, 'weekly');
          break;
        default:
          res.sendStatus(StatusCode.BadRequest);
          return;
      }

      historicalData.sort((itemA, itemB) => itemA.timestamp - itemB.timestamp);

      const respStr = jsonString(historicalData ?? {});
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(respStr);
      return;
    } catch (err) {
      error('error occurred while getting historical twitter data');
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    }
  };
}

async function fetchHistoricalData<Data extends WithTimestamp>(
  source: 'twitter' | 'discord',
  collection: { collectionAddress: string; chainId: string },
  startAt: number,
  to: number,
  limit: number,
  interval: 'hourly' | 'daily' | 'weekly'
) {
  const historicalDocId = source;
  const historicalCollectionRef = firestore
    .collection(firestoreConstants.COLLECTIONS_COLL)
    .doc(getCollectionDocId(collection))
    .collection(firestoreConstants.DATA_SUB_COLL)
    .doc(historicalDocId)
    .collection(firestoreConstants.HISTORICAL_COLL);
  let timestamp = Number(startAt);

  let dataPoints: Array<Record<keyof Data, number>> = [];
  let dataPointLimit = limit;
  const maxTimestamp = to > Date.now() ? Date.now() : to;
  while (dataPointLimit > 0 && timestamp < maxTimestamp + ONE_DAY * 7) {
    const [year, week] = getWeekNumber(new Date(Number(timestamp)));

    const docId = firestore.getHistoricalDocId(year, week);
    const data = (await historicalCollectionRef.doc(docId).get()).data();
    if (data) {
      switch (interval) {
        case 'hourly':
          dataPoints = [...dataPoints, ...averageHistoricalData<Data>(data, 1)];
          break;
        case 'daily':
          dataPoints = [...dataPoints, ...averageHistoricalData<Data>(data, 24)];
          break;
        case 'weekly':
          dataPoints = [...dataPoints, ...averageHistoricalData<Data>(data, 168)];
      }
    }
    dataPoints = dataPoints.filter((item) => item.timestamp >= startAt);
    timestamp += ONE_DAY * 7;

    dataPointLimit = limit - dataPoints.length;
  }

  return dataPoints;
}

/**
 * getCollectionInfoByAddress takes an address and returns the matching collection
 * info object if it exists
 *
 */
async function getCollectionInfoByAddress(data: {
  chainId: string;
  address: string;
}): Promise<CollectionInfo | undefined> {
  const docId = `${data.chainId}:${trimLowerCase(data.address)}`;
  const doc = await firestore.collection(firestoreConstants.COLLECTIONS_COLL).doc(docId).get();

  if (doc.exists) {
    const data = doc.data() as CollectionInfo;
    return data;
  }
}

/**
 * getCollectionInfoByName takes a collection name/slug and a limit then returns an
 * array of the corresponding collection info objects
 *
 */
async function getCollectionInfoByName(searchCollectionName: string, limit: number): Promise<CollectionInfo[]> {
  const res = await firestore
    .collection(firestoreConstants.COLLECTIONS_COLL)
    .where('searchCollectionName', '==', searchCollectionName)
    .limit(limit)
    .get();
  const data: CollectionInfo[] = res.docs.map((doc) => {
    return doc.data() as CollectionInfo;
  });

  return data;
}

async function getTwitterSnippet(
  collection: { collectionAddress: string; chainId: string },
  twitterLink: string,
  forceUpdate = false
) {
  if (!collection.collectionAddress || !twitterLink) {
    return;
  }
  const docId = getCollectionDocId(collection);
  // get snippet
  const twitterRef = firestore
    .collection(firestoreConstants.COLLECTIONS_COLL)
    .doc(docId)
    .collection(firestoreConstants.DATA_SUB_COLL)
    .doc(firestoreConstants.COLLECTION_TWITTER_DOC);
  const twitterSnippet: TwitterSnippet = (await twitterRef.get()).data()?.twitterSnippet;

  const updatedTwitterSnippet = await updateTwitterData(twitterSnippet, collection, twitterLink, forceUpdate);

  return updatedTwitterSnippet;
}

/**
 * updateTwitterData requests recent tweets from twitter (if it should be updated), saves the data to the database and
 * returns the updated collection info
 */
async function updateTwitterData(
  twitterSnippet: TwitterSnippet,
  collection: { collectionAddress: string; chainId: string },
  twitterLink: string,
  force = false
): Promise<TwitterSnippet> {
  try {
    const now = new Date().getTime();
    const updatedAt: number = typeof twitterSnippet?.timestamp === 'number' ? twitterSnippet?.timestamp : 0;
    if (force || (twitterLink && now - updatedAt > MIN_TWITTER_UPDATE_INTERVAL)) {
      const twitterUsernameRegex = /twitter.com\/([a-zA-Z0-9_]*)/;
      const username = twitterLink.match(twitterUsernameRegex)?.[1];

      if (username) {
        // get twitter data
        const twitterClient = new Twitter();
        const twitterData = await twitterClient.getVerifiedAccountMentions(username);

        const newMentions = (twitterData?.tweets || []).map((item) => item.author);
        const ids = new Set();
        const mentions = [...(twitterSnippet?.topMentions ?? []), ...newMentions]
          .sort((itemA, itemB) => itemB.followersCount - itemA.followersCount)
          .filter((item) => {
            if (!ids.has(item.id)) {
              ids.add(item.id);
              return true;
            }
            return false;
          });
        const mentionsSortedByFollowerCount = mentions.sort(
          (userOne: InfinityTwitterAccount, userTwo: InfinityTwitterAccount) =>
            userTwo.followersCount - userOne.followersCount
        );
        const topMentions = mentionsSortedByFollowerCount.slice(0, 10);
        const date = new Date(now);

        const account = twitterData.account ? { account: twitterData.account } : {};
        const updatedTwitterSnippet: TwitterSnippet = {
          recentTweets: twitterData.tweets,
          timestamp: now,
          topMentions: topMentions,
          ...account
        };

        const batch = firestore.db.batch();

        const collectionInfoRef = firestore
          .collection(firestoreConstants.COLLECTIONS_COLL)
          .doc(getCollectionDocId(collection));
        const twitterRef = collectionInfoRef
          .collection(firestoreConstants.DATA_SUB_COLL)
          .doc(firestoreConstants.COLLECTION_TWITTER_DOC);

        /**
         * update collection info tweet snippet
         */
        batch.set(
          twitterRef,
          {
            twitterSnippet: updatedTwitterSnippet
          },
          { merge: true }
        );

        const [year, week] = getWeekNumber(date);
        const docId = firestore.getHistoricalDocId(year, week);
        const hourOfTheWeek = `${date.getUTCDay() * 24 + date.getUTCHours()}`;
        const weekDocRef = twitterRef.collection(firestoreConstants.HISTORICAL_COLL).doc(docId);

        /**
         * update historical data
         */
        batch.set(
          weekDocRef,
          {
            aggregated: { timestamp: now },
            [hourOfTheWeek]: { followersCount: twitterData.account?.followersCount ?? 0, timestamp: now }
          },
          { merge: true }
        );

        // commit this batch so the updated data is available to aggregate the historical data
        await batch.commit();

        const batch2 = firestore.db.batch();

        const historicalRef = twitterRef.collection(firestoreConstants.HISTORICAL_COLL);

        const aggregated = await aggregateHistoricalData<FollowerData, AggregatedFollowerData>(
          historicalRef,
          10,
          batch2
        );

        /**
         *  update snippet with aggregated data
         */
        batch2.set(
          twitterRef,
          {
            twitterSnippet: {
              ...updatedTwitterSnippet,
              aggregated
            }
          },
          { merge: true }
        );

        await batch2.commit();

        return {
          ...updatedTwitterSnippet
        };
      }
    }
  } catch (err) {
    error(`error while updating twitter data for ${collection.collectionAddress}`);
    error(err);
  }
  return twitterSnippet;
}

async function getDiscordSnippet(
  collection: { collectionAddress: string; chainId: string },
  inviteLink: string,
  forceUpdate = false
) {
  try {
    const discordRef = firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(getCollectionDocId(collection))
      .collection(firestoreConstants.DATA_SUB_COLL)
      .doc(firestoreConstants.COLLECTION_DISCORD_DOC);
    let discordSnippet: DiscordSnippet = (await discordRef.get())?.data()?.discordSnippet;

    discordSnippet = await updateDiscordSnippet(discordSnippet, collection, inviteLink, forceUpdate);

    return discordSnippet;
  } catch (err) {
    error('error occurred while getting discord snippet');
    error(err);
  }
}

export async function updateDiscordSnippet(
  discordSnippet: DiscordSnippet,
  collection: { collectionAddress: string; chainId: string },
  inviteLink: string,
  force = false
) {
  try {
    const now = new Date().getTime();

    const updatedAt: number = typeof discordSnippet?.timestamp === 'number' ? discordSnippet?.timestamp : 0;
    const shouldUpdate = now - updatedAt > MIN_DISCORD_UPDATE_INTERVAL;

    if (shouldUpdate || force) {
      const discord = new DiscordAPI();
      const res = await discord.getMembers(inviteLink);
      if (res) {
        const updatedSnippet: DiscordSnippet = {
          membersCount: res.members,
          presenceCount: res.presence,
          timestamp: new Date().getTime()
        };

        const batch = firestore.db.batch();

        const collectionInfoRef = firestore
          .collection(firestoreConstants.COLLECTIONS_COLL)
          .doc(getCollectionDocId(collection));
        const discordRef = collectionInfoRef
          .collection(firestoreConstants.DATA_SUB_COLL)
          .doc(firestoreConstants.COLLECTION_DISCORD_DOC);

        /**
         * update collection info tweet snippet
         */
        batch.set(
          discordRef,
          {
            discordSnippet: updatedSnippet
          },
          { merge: true }
        );

        const date = new Date(now);
        const [year, week] = getWeekNumber(date);
        const docId = firestore.getHistoricalDocId(year, week);

        const hourOfTheWeek = `${date.getUTCDay() * 24 + date.getUTCHours()}`;

        const weekDocRef = discordRef.collection(firestoreConstants.HISTORICAL_COLL).doc(docId);

        /**
         * update historical data
         */
        batch.set(
          weekDocRef,
          {
            aggregated: { timestamp: now },
            [hourOfTheWeek]: updatedSnippet
          },
          { merge: true }
        );

        // commit this batch so the updated data is available to aggregate the historical data
        await batch.commit();

        const batch2 = firestore.db.batch();

        const historicalRef = discordRef.collection(firestoreConstants.HISTORICAL_COLL);

        const aggregated = await aggregateHistoricalData<DiscordSnippet, AggregatedDiscordData>(
          historicalRef,
          10,
          batch2
        );

        /**
         *  update snippet with aggregated data
         */
        batch2.set(
          discordRef,
          {
            discordSnippet: {
              ...updatedSnippet,
              aggregated
            }
          },
          { merge: true }
        );

        await batch2.commit();

        return {
          ...updatedSnippet
        };
      }
    }
  } catch (err) {
    error('error occurred while getting discord snippet');
    error(err);
  }

  return discordSnippet;
}
