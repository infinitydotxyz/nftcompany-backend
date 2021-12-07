import { Router } from 'express';
import nfts from './nfts';
import opensea from './opensea';
import u from './u';
import token from './token';

const router = Router();

router.use('/nfts', nfts);
router.use('./opensea', opensea);
router.use('/token', token);
router.use('/u', u);

export default router;
