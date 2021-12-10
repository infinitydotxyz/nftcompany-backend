import { Router } from 'express';
import { authorizeUser } from '@base/middleware/auth.js';
import { postTxnCheck } from './:user/wyvern/v1/txns/check';
import { getUserTxns, postUserTxn } from './:user/wyvern/v1/txns';
import { postUserOrders } from './:user/wyvern/v1/orders';
import { getUserAssets } from './:user/assets';
import { getUserEmail } from './:user/getEmail';
import { getUserListings } from './:user/listings';
import { getUserOffersMade } from './:user/offersmade';
import { getUserOffersReceived } from './:user/offersreceived';
import { getUserReward } from './:user/reward';
import { postSetUserEmail } from './:user/setEmail';
import { postSubscribeUserEmail } from './:user/subscribeEmail';
import { postUsPerson } from './:user/usperson';
import { lowRateLimit, postUserRateLimit } from '@base/middleware/rateLimit';

const router = Router();

router.use('/:user', authorizeUser);
router.get('/:user/wyvern/v1/txns', getUserTxns);
router.get('/:user/wyvern/v1/assets', getUserAssets);
router.get('/:user/getEmail', getUserEmail);
router.get('/:user/listings', getUserListings);
router.get('/:user/offersmade', getUserOffersMade);
router.get('/:user/offersreceived', getUserOffersReceived);
router.get('/:user/reward', getUserReward);

router.post('/:user/setEmail', lowRateLimit, postSetUserEmail);
router.post('/:user/subscribeEmail', lowRateLimit, postSubscribeUserEmail);
router.post('/:user/usperson', lowRateLimit, postUsPerson);

router.post('/:user/wyvern/v1/txns/check', postUserRateLimit, postTxnCheck);
router.post('/:user/wyvern/v1/txns', postUserRateLimit, postUserTxn);
router.post('/:user/wyvern/v1/orders', postUserRateLimit, postUserOrders);

export default router;
