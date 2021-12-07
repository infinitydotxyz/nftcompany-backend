import { Router } from 'express';
import listings from './listings.js';

const router = Router();

router.use('/opensea', listings);

export default router;
