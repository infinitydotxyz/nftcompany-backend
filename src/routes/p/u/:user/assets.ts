import { fetchAssetsOfUser } from '@routes/u/:user/assets';
import { Request, Response } from 'express';

export const getUserAssets = (req: Request<{ user: string }>, res: Response) => {
  fetchAssetsOfUser(req, res);
};
