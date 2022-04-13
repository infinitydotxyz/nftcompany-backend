import { Request, Response } from 'express';
import { error, jsonString } from '@infinityxyz/lib/utils';
import { StatusCode } from '@infinityxyz/lib/types/core';
import { isTokenVerified } from 'services/infinity/collections/isTokenVerified';
import { hasBonusReward } from 'services/infinity/collections/hasBonusReward';

// Check if token is verified or has bonus reward
export const getVerifiedBonusReward = async (
  req: Request<{ tokenAddress: string; chainId: string }>,
  res: Response
) => {
  const tokenAddress = (`${req.params.tokenAddress}` || '').trim().toLowerCase();
  const chainId = req.params.chainId.trim();

  if (!tokenAddress) {
    error('Empty token address');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    const [verified, bonusReward] = await Promise.all([
      isTokenVerified({ collectionAddress: tokenAddress, chainId }),
      hasBonusReward(tokenAddress)
    ]);

    const resp = {
      verified,
      bonusReward
    };

    const respStr = jsonString(resp);

    // To enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=3600',
      'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
    });
    res.send(respStr);
  } catch (err: any) {
    error('Error in checking whether token: ' + tokenAddress + ' is verified or has bonus');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
