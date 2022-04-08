import { Router } from 'express';
import listings from './listings';
import p from './p';
import rewards from './rewards';
import token from './token';
import u from './u';
import wyvernV1 from './wyvern/v1';
import events from './events';
import titles from './titles';
import verifyEmail from './verifyEmail';
import marketListings from './marketListings';

const router = Router();

router.use('/listings', listings);
router.use('/p', p);
router.use('/rewards', rewards);
router.use('/token', token);
router.use('/wyvern/v1', wyvernV1);
router.use('/events', events);
router.use('/titles', titles);
router.use('/verifyEmail', verifyEmail);
router.use('/marketListings', marketListings);

/**
 * Require auth
 */
router.use('/u', u);

export default router;
