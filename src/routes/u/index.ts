import { Router } from 'express';
import { authorizeUser } from '@base/middleware/auth.js';
import user from './:user';

const router = Router();

router.use('/', authorizeUser);

router.use('/:user', user);

export default router;
