// import { firestore } from '@base/container';
import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import CollectionsController from '@services/infinity/collections/CollectionsController';
import { getUserInfoRef } from '@services/infinity/users/getUser';
import { convertOpenseaListingsToInfinityListings } from '@services/opensea/utils';
import { error } from '@utils/logger';
import { ethers } from 'ethers';
import { Request, Response } from 'express';

/**
 * getUserVotes supports 2 queries
 * 1. if a collectionAddress is NOT supplied, all votes by a user will be returned
 * 2. if a collectionAddress IS supplied, the user's vote on that collection along with vote data
 *      for the specified collection will be returned
 */
export async function getUserVotes(
  req: Request<{ user: string }, any, any, { collectionAddress: string }>,
  res: Response
) {
  const user = req.params.user.toLowerCase();
  const collectionAddress = (req.query.collectionAddress ?? '').toLowerCase();

  if (collectionAddress && !ethers.utils.isAddress(collectionAddress)) {
    res.send(StatusCode.BadRequest);
    return;
  }

  const userVotes = getUserInfoRef(user).collection(fstrCnstnts.VOTES_COLL);

  try {
    if (collectionAddress) {
      console.log('getting votes for collection ', collectionAddress);
      const userVoteInCollection = (await userVotes.doc(collectionAddress).get()).data();
      // user has not voted  on this collection
      if (!userVoteInCollection) {
        // users must vote before they can see votes
        res.send({});
        return;
      }
      const collectionsController = new CollectionsController();
      const collectionVotes = await collectionsController.getCollectionVotes(collectionAddress);
      res.send({ votes: collectionVotes, userVote: userVoteInCollection });
      return;
    } else {
      console.log('getting all user votes ');
      const allUserVotes = ((await userVotes.get())?.docs ?? [])?.map?.((doc) => {
        return { ...doc.data(), collectionAddress: doc.id };
      });

      res.send({
        userVotes: allUserVotes
      });
      return;
    }
  } catch (err) {
    error('error occurred while getting user votes');
    error(err);
  }
}

/**
 * postUserVote can be used to set/update a user's vote for a collection
 */
export async function postUserVote(
  req: Request<{ user: string }, any, { collectionAddress: string; votedFor: boolean }>,
  res: Response
) {
  const user = req.params.user.toLowerCase();
  const collectionAddress = req.body.collectionAddress.toLowerCase();
  const votedFor = req.body.votedFor;

  if (!ethers.utils.isAddress(collectionAddress) || typeof votedFor !== 'boolean') {
    res.send(StatusCode.BadRequest);
    return;
  }

  const voteObj = {
    votedFor: votedFor,
    timestamp: Date.now()
  };

  try {
    const userVotesCollRef = getUserInfoRef(user).collection(fstrCnstnts.VOTES_COLL).doc(collectionAddress);

    const batch = firestore.db.batch();

    batch.set(userVotesCollRef, voteObj, {});

    const userCollectionVotesRef = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .doc(collectionAddress)
      .collection(fstrCnstnts.VOTES_COLL)
      .doc(user);
    batch.set(userCollectionVotesRef, voteObj);

    await batch.commit();

    res.sendStatus(StatusCode.Ok);

    return;
  } catch (err) {
    error('error occurred while updating user vote');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
}
