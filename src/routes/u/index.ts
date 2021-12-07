import { Router } from 'express';
import { authorizeUser } from '@utils/auth.js';

const router = Router();

router.use('/u', authorizeUser);

export default router;
