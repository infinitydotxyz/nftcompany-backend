import { getUserAssets as getUserAssetsHelper } from '@routes/u/_user/assets';
import { Request, Response } from 'express';

export const getUserAssets = async (
  req: Request<{ user: string }, any, any, { source: string; collectionIds?: string; contract: string, chainId: string }>,
  res: Response
) => {
  await getUserAssetsHelper(req, res);
};
