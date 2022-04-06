import { Router } from 'express';
import { authenticateUser } from 'middleware/auth';
import { postTxnCheck } from './_user/wyvern/v1/txns/check';
import { getUserTxns, postUserTxn } from './_user/wyvern/v1/txns';
import { postUserOrders } from './_user/wyvern/v1/orders';
import { getUserAssets } from './_user/assets';
import { getUserEmail } from './_user/getEmail';
import { getUserListings } from './_user/listings';
import { getUserOffersMade } from './_user/offersmade';
import { getUserOffersReceived } from './_user/offersreceived';
import { getUserReward } from './_user/reward';
import { postSetUserEmail } from './_user/setEmail';
import { postSubscribeUserEmail } from './_user/subscribeEmail';
import { postUsPerson } from './_user/usperson';
import { lowRateLimit, postUserRateLimit } from 'middleware/rateLimit';
import { getUserVotes, postUserVote } from './_user/vote';
import { getCollectionFollows, setCollectionFollow } from './_user/collectionFollows';
import { getUserFollows, setUserFollow } from './_user/userFollows';
import { getUserFeed } from './_user/userFeed';
import { market } from './_user/market';

const router = Router();

router.use('/:user', authenticateUser);

router.get('/:user/wyvern/v1/txns', getUserTxns);
router.get('/:user/assets', getUserAssets);
router.get('/:user/getEmail', getUserEmail);
router.get('/:user/listings', getUserListings);
router.get('/:user/offersmade', getUserOffersMade);
router.get('/:user/offersreceived', getUserOffersReceived);
router.get('/:user/reward', getUserReward);
router.get('/:user/vote', getUserVotes);
router.get('/:user/collectionFollows', getCollectionFollows);
router.get('/:user/userFollows', getUserFollows);
router.get('/:user/feed', getUserFeed);

router.post('/:user/setEmail', lowRateLimit, postSetUserEmail);
router.post('/:user/subscribeEmail', lowRateLimit, postSubscribeUserEmail);
router.post('/:user/usperson', lowRateLimit, postUsPerson);
router.post('/:user/vote', lowRateLimit, postUserVote);
router.post('/:user/wyvern/v1/txns/check', postUserRateLimit, postTxnCheck);
router.post('/:user/wyvern/v1/txns', postUserRateLimit, postUserTxn);
router.post('/:user/wyvern/v1/orders', postUserRateLimit, postUserOrders);
router.post('/:user/collectionFollows', postUserRateLimit, setCollectionFollow);
router.post('/:user/userFollows', postUserRateLimit, setUserFollow);
router.post('/:user/market', postUserRateLimit, market);

export default router;
