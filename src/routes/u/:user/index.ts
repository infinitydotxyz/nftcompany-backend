import { Router } from 'express';
import wyvernV1 from './wyvern/v1/index';
import assets from './assets';
import getEmail from './getEmail';
import listings from './listings';
import offersMade from './offersmade';
import offersReceived from './offersreceived';
import reward from './reward';
import setEmail from './setEmail';
import subscribeEmail from './subscribeEmail';
import usperson from './usperson';

const router = Router();

router.use('/wyvern/v1', wyvernV1);
router.use('/assets', assets);
router.use('/getEmail', getEmail);
router.use('/listings', listings);
router.use('/offersMade', offersMade);
router.use('/offersReceived', offersReceived);
router.use('/reward', reward);
router.use('/setEmail', setEmail);
router.use('/subscribeEmail', subscribeEmail);
router.use('/usperson', usperson);

export default router;
