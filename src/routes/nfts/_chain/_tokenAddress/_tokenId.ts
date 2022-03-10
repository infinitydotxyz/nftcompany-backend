import { StatusCode } from '@infinityxyz/lib/types/core';
import { getChainId, getProvider } from 'utils/ethers';
import { error, jsonString, trimLowerCase } from '@infinityxyz/lib/utils';
import { ethers } from 'ethers';
import { Request, Response } from 'express';

// todo: adi change this
import dogeAbi from 'abi/doge2048nft.json';
// todo: adi change this
import factoryAbi from 'abi/infinityFactory.json';
import { metadataForDoge2048Nft } from 'routes/nfts/doge_builder/images';

// todo: adi constants
const dogTokenAddress = '0x3604035F54e5fe0875652842024b49D1Fea11C7C';

// api to get metadata
export const getAssetMetadata = async (
  req: Request<{ tokenAddress: string; tokenId: string; chain: string }>,
  res: Response
) => {
  const tokenAddress = trimLowerCase(req.params.tokenAddress);
  const tokenId = req.params.tokenId;
  const chain = trimLowerCase(req.params.chain);
  try {
    // read data from chain
    const chainId = getChainId(chain);
    const provider = getProvider(chainId);
    if (!provider) {
      error('Chain provider is null for chain', chainId);
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    // todo: adi generalize this
    const factoryContract = new ethers.Contract(tokenAddress, factoryAbi, provider);
    const instanceAddress = await factoryContract.tokenIdToInstance(+tokenId);
    const contract = new ethers.Contract(instanceAddress, dogeAbi, provider);
    const score = await contract.score();
    const numPlays = await contract.numPlays();
    const dogBalance = await contract.getTokenBalance(dogTokenAddress);
    const finalDogBalance: number = dogBalance ? parseInt(ethers.utils.formatEther(dogBalance)) : 0;
    const metadata = await metadataForDoge2048Nft(chainId, tokenAddress, +tokenId, score, numPlays, finalDogBalance);
    const result = {
      image: metadata.image,
      name: 'Doge 2048',
      description: 'NFT based 2048 game with much wow',
      attributes: metadata.attributes
    };
    res.send(jsonString(result));
  } catch (err) {
    error('Failed fetching metadata for', tokenAddress, tokenId, chain);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
