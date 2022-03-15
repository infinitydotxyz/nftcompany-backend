import { Twitter } from 'services/twitter/Twitter';
import { InfinityTwitterAccount } from '@infinityxyz/lib/types/services/twitter';
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import { firestore } from 'container';
import {
  fstrCnstnts,
  MIN_COLLECTION_STATS_UPDATE_INTERVAL,
  MIN_DISCORD_UPDATE_INTERVAL,
  MIN_LINK_UPDATE_INTERVAL,
  MIN_TWITTER_UPDATE_INTERVAL,
  ONE_DAY
} from '../../constants';
import {
  CollectionInfo,
  DiscordSnippet,
  CollectionStats,
  TwitterSnippet,
  EditableCollectionData,
  CollectionData,
  UpdateCollectionDataRequest,
  Keys,
  Optional,
  Links,
  WithTimestamp,
  StatusCode
} from '@infinityxyz/lib/types/core';
import { getWeekNumber } from 'utils';
import { aggregateHistoricalData, averageHistoricalData } from '../../services/infinity/aggregateHistoricalData';
import { getCollectionInfoFromOpensea, getCollectionLinks } from 'services/opensea/collection/getContract';
import { getCollectionStats } from 'services/opensea/collection/getCollectionStats';
import { DiscordAPI } from 'services/discord/DiscordAPI';
import { CollectionAuthType } from 'middleware/auth';
import { UploadedFile } from 'express-fileupload';
import { getCollectionFromOpensea } from 'services/opensea/collection/getCollection';
import { getChainId } from 'utils/ethers';
import { error, jsonString, log } from '@infinityxyz/lib/utils';

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

export async function updateCollectionInfoFromOpensea(address: string): Promise<CollectionInfo | undefined> {
  let collectionInfo = await getCollectionInfoFromOpensea(address);
  if (!collectionInfo) {
    return;
  }

  try {
    if (collectionInfo.slug) {
      const collection = await getCollectionFromOpensea(collectionInfo.slug);
      const chain =
        (collection?.payment_tokens ?? []).findIndex((item) => item.symbol === 'ETH') >= 0 ? 'Ethereum' : 'Polygon';

      collectionInfo = {
        ...collectionInfo,
        chain,
        chainId: getChainId(chain)
      };

      try {
        await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(address).set(collectionInfo, { merge: true });
      } catch (err) {
        error('Error occurred while setting collection info in firestore');
        error(err);
      }

      return collectionInfo;
    }
  } catch (err) {
    error('Error occurred while getting traits from opensea');
    error(err);
  }
}

/**
 * getCollectionInfo handles a request for collection info by slug or collection address
 */
export async function getCollectionInfo(req: Request<{ slug: string }>, res: Response) {
  const slugOrAddress = req.params.slug;
  try {
    log('Fetching collection info for', slugOrAddress);

    let collectionInfo: CollectionInfo | undefined;
    /**
     * get base collection info
     */
    if (ethers.utils.isAddress(slugOrAddress)) {
      const address = slugOrAddress.trim().toLowerCase();
      collectionInfo = await getCollectionInfoByAddress(address);

      /**
       * if we do not have collection info, get it from opensea
       */
      if (!collectionInfo?.name) {
        collectionInfo = await updateCollectionInfoFromOpensea(address);
      }
    } else {
      const data = await getCollectionInfoByName(slugOrAddress, 1);
      collectionInfo = data?.[0];
    }

    if (!collectionInfo) {
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
  req: Request<{ collection: string; user: string }>,
  res: Response<any, { authType: CollectionAuthType }>
) {
  const address = req.params.collection.trim().toLowerCase();

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
    const collectionInfo = await getCollectionInfoByAddress(address);
    let collectionData: CollectionData | undefined;
    if (collectionInfo) {
      collectionData = await getCollectionDataFromCollectionInfo(collectionInfo);
    }

    /**
     * creator clicked edit button for the first time
     */
    if (!collectionData?.isClaimed && isCreator) {
      const collectionInfoRef = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(address);
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
  req: Request<{ collection: string; user: string }, any, { data: string }>,
  res: Response<any, { authType: CollectionAuthType }>
) {
  const collectionAddress = req.params.collection.trim().toLowerCase();
  // const editor = trimLowerCase(req.params.user);
  // const editorType = res.locals.authType;

  try {
    const data: UpdateCollectionDataRequest = JSON.parse(req.body.data);
    const profileImageFile: UploadedFile = req?.files?.profileImage as UploadedFile;
    let profileImageUpdate = {};
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

    const collectionInfoUpdate: Optional<
      Pick<EditableCollectionData, 'profileImage' | 'name' | 'description' | 'benefits' | 'partnerships'>,
      'profileImage'
    > = {
      name: data.name ?? '',
      description: data.description ?? '',
      benefits: data.benefits ?? [],
      partnerships: data.partnerships ?? [],
      ...profileImageUpdate
    };

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

    const batch = firestore.db.batch();
    const collectionInfoRef = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(collectionAddress);
    const collectionLinksRef = collectionInfoRef
      .collection(fstrCnstnts.COLLECTION_SOCIALS_COLL)
      .doc(fstrCnstnts.COLLECTION_LINKS_DOC);

    batch.set(collectionInfoRef, collectionInfoUpdate, { merge: true });

    batch.set(collectionLinksRef, collectionLinkUpdate, { merge: true });

    await batch.commit();

    res.sendStatus(StatusCode.Created);

    const forceUpdate = true;
    /**
     * handles updating twitter data
     */
    getTwitterSnippet(collectionAddress, data.twitter, forceUpdate)
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
    getDiscordSnippet(collectionAddress, data.discord, forceUpdate)
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
  /**
   * get links and stats
   * links are required for updating discord and twitter snippets
   */
  if (collectionInfo?.address) {
    const isClaimed = collectionInfo.isClaimed ?? false;
    const linksAndStats = await getLinksAndStats(
      collectionInfo.address,
      isClaimed,
      collectionData?.profileImage,
      collectionData?.searchCollectionName,
      collectionData?.name
    );
    if (linksAndStats?.links) {
      collectionData.links = linksAndStats.links;
    }
    if (linksAndStats?.stats) {
      collectionData.stats = linksAndStats.stats;
    }
  }

  const promises: Array<Promise<DiscordSnippet | TwitterSnippet | undefined>> = [];
  let discordSnippetPromise: Promise<DiscordSnippet | undefined>;
  if (collectionData?.links?.discord) {
    discordSnippetPromise = getDiscordSnippet(collectionData.address, collectionData.links.discord);
    promises.push(discordSnippetPromise);
  }

  let twitterSnippetPromise: Promise<TwitterSnippet | undefined>;
  if (collectionData?.links?.twitter) {
    twitterSnippetPromise = getTwitterSnippet(collectionData.address, collectionData.links.twitter);
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
export async function getCollectionVotes(
  collectionAddress: string
): Promise<{ votesFor: number; votesAgainst: number }> {
  const votes = await countVotes(collectionAddress);
  return votes;
}

async function countVotes(collectionAddress: string) {
  const address = collectionAddress.toLowerCase();
  const votesRef = firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .doc(address)
    .collection(fstrCnstnts.VOTES_COLL);

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
      { id: string },
      any,
      any,
      { from?: number; to?: number; interval?: 'hourly' | 'daily' | 'weekly'; startAt?: number }
    >,
    res: Response
  ) => {
    const interval = req.query.interval ?? 'hourly';
    const ONE_WEEK = ONE_DAY * 7;
    const address = req.params.id.toLowerCase();

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
          historicalData = await fetchHistoricalData<Data>(source, address, startAt, to, limit, 'hourly');
          break;
        case 'daily':
          from = Number(req.query.from ?? Date.now() - FOUR_WEEKS);
          startAt = Number(req.query.startAt ?? from);
          to = Number(req.query.to ?? from + FOUR_WEEKS);
          if (to - startAt > maxRange) {
            to = startAt + maxRange;
          }
          historicalData = await fetchHistoricalData<Data>(source, address, startAt, to, limit, 'daily');
          break;
        case 'weekly':
          from = Number(req.query.from ?? Date.now() - EIGHT_WEEKS);
          startAt = Number(req.query.startAt ?? from);
          to = Number(req.query.to ?? from + EIGHT_WEEKS);
          if (to - startAt > maxRange) {
            to = startAt + maxRange;
          }
          historicalData = await fetchHistoricalData<Data>(source, address, startAt, to, limit, 'weekly');
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
  address: string,
  startAt: number,
  to: number,
  limit: number,
  interval: 'hourly' | 'daily' | 'weekly'
) {
  const historicalDocId = source;
  const historicalCollectionRef = firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .doc(address)
    .collection(fstrCnstnts.COLLECTION_SOCIALS_COLL)
    .doc(historicalDocId)
    .collection(fstrCnstnts.HISTORICAL_COLL);
  let timestamp: number = Number(startAt);

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

async function getLinksAndStats(
  collectionAddress?: string,
  isClaimed?: boolean,
  profileImage?: string,
  searchCollectionName?: string,
  collectionName?: string
) {
  if (!collectionAddress) {
    return { links: undefined, stats: undefined };
  }

  const linkRef = firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .doc(collectionAddress)
    .collection(fstrCnstnts.COLLECTION_SOCIALS_COLL)
    .doc(fstrCnstnts.COLLECTION_LINKS_DOC);

  let links: Links | undefined = (await linkRef.get())?.data() as Links;

  if (!isClaimed) {
    // once claimed the editors must update their collection info
    links = await updateLinks(links, collectionAddress, false);
  }

  const statsRef = firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .doc(collectionAddress)
    .collection(fstrCnstnts.COLLECTION_STATS_COLL)
    .doc(fstrCnstnts.COLLECTION_OPENSEA_STATS_DOC);

  let stats: CollectionStats | undefined = (await statsRef.get())?.data() as CollectionStats;

  if (links?.slug) {
    stats = await updateStats(
      stats,
      collectionAddress,
      links.slug,
      profileImage,
      searchCollectionName,
      collectionName,
      false
    );
  }

  try {
    return {
      links,
      stats
    };
  } catch (err) {
    error('error occurred while getting collection links and stats');
    error(err);
  }
}

async function updateStats(
  stats: CollectionStats,
  collectionAddress: string,
  openseaSlug: string,
  profileImage?: string,
  searchCollectionName?: string,
  collectionName?: string,
  force = false
) {
  const now = new Date().getTime();

  const updatedAt = stats?.timestamp ? stats?.timestamp : 0;
  const shouldUpdate = now - updatedAt > MIN_COLLECTION_STATS_UPDATE_INTERVAL;

  try {
    if ((shouldUpdate || force) && openseaSlug) {
      const updatedStats = await getCollectionStats(openseaSlug);
      const votes = await getCollectionVotes(collectionAddress);

      if (updatedStats) {
        const statsRef = firestore
          .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
          .doc(collectionAddress)
          .collection(fstrCnstnts.COLLECTION_STATS_COLL)
          .doc(fstrCnstnts.COLLECTION_OPENSEA_STATS_DOC);

        void (await statsRef.set(
          {
            ...updatedStats,
            collectionAddress,
            profileImage: profileImage ?? '',
            searchCollectionName: searchCollectionName ?? '',
            name: collectionName ?? '',
            ...votes
          },
          {
            mergeFields: [
              'averagePrice',
              'collectionAddress',
              'profileImage',
              'searchCollectionName',
              'count',
              'floorPrice',
              'marketCap',
              'owners',
              'oneDay.averagePrice',
              'oneDay.change',
              'oneDay.sales',
              'oneDay.volume',
              'sevenDay.averagePrice',
              'sevenDay.change',
              'sevenDay.sales',
              'sevenDay.volume',
              'thirtyDay.averagePrice',
              'thirtyDay.change',
              'thirtyDay.sales',
              'thirtyDay.volume',
              'total.sales',
              'total.volume',
              'total.supply',
              'votesFor',
              'votesAgainst',
              'name'
            ]
          }
        ));

        return updatedStats;
      }
    }
  } catch (err) {
    error('error occurred while updating stats');
    error(err);
  }

  return stats;
}

async function updateLinks(links: Links, collectionAddress: string, force = false) {
  const now = new Date().getTime();

  const updatedAt = links?.timestamp ? links?.timestamp : 0;
  const shouldUpdate = now - updatedAt > MIN_LINK_UPDATE_INTERVAL;

  try {
    if (shouldUpdate || force) {
      const updatedLinks = await getCollectionLinks(collectionAddress);
      if (updatedLinks) {
        const artBlocksContracts = [
          '0x059edd72cd353df5106d2b9cc5ab83a52287ac3a',
          '0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270'
        ];
        if (artBlocksContracts.includes(collectionAddress?.toLowerCase())) {
          updatedLinks.slug = 'art-blocks';
        }
        const linkRef = firestore
          .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
          .doc(collectionAddress)
          .collection(fstrCnstnts.COLLECTION_SOCIALS_COLL)
          .doc(fstrCnstnts.COLLECTION_LINKS_DOC);
        await linkRef.set(
          {
            ...updatedLinks
          },
          { merge: true }
        );

        return updatedLinks;
      }
    }
  } catch (err) {
    error('error occurred while updating links');
    error(err);
  }

  return links;
}

/**
 * getCollectionInfoByAddress takes an address and returns the matching collection
 * info object if it exists
 *
 */
async function getCollectionInfoByAddress(address: string): Promise<CollectionInfo | undefined> {
  const doc = await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(address).get();

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
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .where('searchCollectionName', '==', searchCollectionName)
    .limit(limit)
    .get();
  const data: CollectionInfo[] = res.docs.map((doc) => {
    return doc.data() as CollectionInfo;
  });

  return data;
}

async function getTwitterSnippet(collectionAddress: string, twitterLink: string, forceUpdate = false) {
  if (!collectionAddress || !twitterLink) {
    return;
  }
  // get snippet
  const twitterRef = firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .doc(collectionAddress)
    .collection(fstrCnstnts.COLLECTION_SOCIALS_COLL)
    .doc(fstrCnstnts.COLLECTION_TWITTER_DOC);
  const twitterSnippet: TwitterSnippet = (await twitterRef.get()).data()?.twitterSnippet;

  const updatedTwitterSnippet = await updateTwitterData(twitterSnippet, collectionAddress, twitterLink, forceUpdate);

  return updatedTwitterSnippet;
}

/**
 * updateTwitterData requests recent tweets from twitter (if it should be updated), saves the data to the database and
 * returns the updated collection info
 */
async function updateTwitterData(
  twitterSnippet: TwitterSnippet,
  collectionAddress: string,
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

        const collectionInfoRef = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(collectionAddress);
        const twitterRef = collectionInfoRef
          .collection(fstrCnstnts.COLLECTION_SOCIALS_COLL)
          .doc(fstrCnstnts.COLLECTION_TWITTER_DOC);

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

        const weekDocRef = twitterRef.collection('historical').doc(docId);

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

        const historicalRef = twitterRef.collection('historical');

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

        const currentFollowers = aggregated?.current?.followersCount ?? 0;
        const oneDayAgo = currentFollowers - (aggregated?.oneDayAgo?.followersCount ?? 0);
        const sevenDaysAgo = currentFollowers - (aggregated?.weekly?.[0].weekStart?.followersCount ?? 0);
        const thirtyDaysAgo = currentFollowers - (aggregated?.weekly?.[5]?.weekEnd?.followersCount ?? 0);

        const statsRef = collectionInfoRef
          .collection(fstrCnstnts.COLLECTION_STATS_COLL)
          .doc(fstrCnstnts.COLLECTION_OPENSEA_STATS_DOC);
        batch2.set(
          statsRef,
          {
            oneDay: {
              twitterFollowers: oneDayAgo
            },
            sevenDay: {
              twitterFollowers: sevenDaysAgo
            },
            thirtyDay: {
              twitterFollowers: thirtyDaysAgo
            },
            twitterFollowers: currentFollowers
          },
          {
            mergeFields: [
              'oneDay.twitterFollowers',
              'sevenDay.twitterFollowers',
              'thirtyDay.twitterFollowers',
              'twitterFollowers'
            ]
          }
        );

        await batch2.commit();

        return {
          ...updatedTwitterSnippet
        };
      }
    }
  } catch (err) {
    error(`error while updating twitter data for ${collectionAddress}`);
    error(err);
  }
  return twitterSnippet;
}

async function getDiscordSnippet(collectionAddress: string, inviteLink: string, forceUpdate = false) {
  if (!collectionAddress) {
    return;
  }
  try {
    const discordRef = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .doc(collectionAddress)
      .collection(fstrCnstnts.COLLECTION_SOCIALS_COLL)
      .doc(fstrCnstnts.COLLECTION_DISCORD_DOC);
    let discordSnippet: DiscordSnippet = (await discordRef.get())?.data()?.discordSnippet;

    discordSnippet = await updateDiscordSnippet(discordSnippet, collectionAddress, inviteLink, forceUpdate);

    return discordSnippet;
  } catch (err) {
    error('error occurred while getting discord snippet');
    error(err);
  }
}

export async function updateDiscordSnippet(
  discordSnippet: DiscordSnippet,
  collectionAddress: string,
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

        const collectionInfoRef = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(collectionAddress);
        const discordRef = collectionInfoRef
          .collection(fstrCnstnts.COLLECTION_SOCIALS_COLL)
          .doc(fstrCnstnts.COLLECTION_DISCORD_DOC);

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

        const weekDocRef = discordRef.collection('historical').doc(docId);

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

        const historicalRef = discordRef.collection('historical');

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

        const currentMembers = aggregated?.current?.membersCount ?? 0;
        const oneDayAgoMembers = currentMembers - (aggregated?.oneDayAgo?.membersCount ?? 0);
        const sevenDaysAgoMembers = currentMembers - (aggregated?.weekly?.[0].weekStart?.membersCount ?? 0);
        const thirtyDaysAgoMembers = currentMembers - (aggregated?.weekly?.[5]?.weekEnd?.membersCount ?? 0);

        const currentPresence = aggregated?.current?.presenceCount ?? 0;
        const oneDayAgoPresence = currentMembers - (aggregated?.oneDayAgo?.presenceCount ?? 0);
        const sevenDaysAgoPresence = currentMembers - (aggregated?.weekly?.[0].weekStart?.presenceCount ?? 0);
        const thirtyDaysAgoPresence = currentMembers - (aggregated?.weekly?.[5]?.weekEnd?.presenceCount ?? 0);

        const statsRef = collectionInfoRef
          .collection(fstrCnstnts.COLLECTION_STATS_COLL)
          .doc(fstrCnstnts.COLLECTION_OPENSEA_STATS_DOC);
        batch2.set(
          statsRef,
          {
            oneDay: {
              discordMembers: oneDayAgoMembers,
              discordPresence: oneDayAgoPresence
            },
            sevenDay: {
              discordMembers: sevenDaysAgoMembers,
              discordPresence: sevenDaysAgoPresence
            },
            thirtyDay: {
              discordMembers: thirtyDaysAgoMembers,
              discordPresence: thirtyDaysAgoPresence
            },
            discordMembers: currentMembers,
            discordPresence: currentPresence
          },
          {
            mergeFields: [
              'oneDay.discordMembers',
              'oneDay.discordPresence',
              'sevenDay.discordMembers',
              'sevenDay.discordPresence',
              'thirtyDay.discordMembers',
              'thirtyDay.discordPresence',
              'discordMembers',
              'discordPresence'
            ]
          }
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
