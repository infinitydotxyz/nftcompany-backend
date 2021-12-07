import { Router } from 'express';
import listings from './listings.js';

const router = Router();

router.use('/listings', listings);

export default router;
