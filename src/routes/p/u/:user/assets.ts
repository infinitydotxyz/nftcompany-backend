import { fetchAssetsOfUser } from '@routes/u/:user/assets';
import { Request, Response } from 'express';

export const getUserAssets = async (req: Request<{ user: string }>, res: Response) => {
  await fetchAssetsOfUser(req, res);
};
