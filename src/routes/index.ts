import { Router } from 'express';
import nfts from './nfts';
import opensea from './opensea';
import u from './u';
import token from './token';

const router = Router();

router.use('/', nfts);
router.use('/', opensea);
router.use('/', token);
router.use('/', u);

export default router;
