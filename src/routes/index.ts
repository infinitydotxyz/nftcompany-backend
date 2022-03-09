import { Router } from 'express';
import collections from './collections';
import listings from './listings';
import nfts from './nfts';
import p from './p';
import rewards from './rewards';
import token from './token';
import u from './u';
import wyvernV1 from './wyvern/v1';
import events from './events';
import featuredCollections from './featured-collections';
import titles from './titles';
import verifiedCollections from './verifiedCollections';
import verifyEmail from './verifyEmail';
import collection from './collection';
import market from './market/market';

const router = Router();

router.use('/collections', collections);
router.use('/listings', listings);
router.use('/nfts', nfts);
router.use('/p', p);
router.use('/rewards', rewards);
router.use('/token', token);
router.use('/wyvern/v1', wyvernV1);
router.use('/events', events);
router.use('/featured-collections', featuredCollections);
router.use('/titles', titles);
router.use('/verifiedCollections', verifiedCollections);
router.use('/verifyEmail', verifyEmail);
router.use('/collection', collection);
router.use('/market', market);

/**
 * require auth
 */
router.use('/u', u);

export default router;
