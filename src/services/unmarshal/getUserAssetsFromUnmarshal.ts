import { error, log } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { UnmarshalUserAssetResponse } from './types/UnmarshalUserAsset';
import { unmarshalClient } from './utils';

/**
 * Docs: https://docs.unmarshal.io/nft-apis/nft-assets-by-address
 */
export async function getUserAssetsFromUnmarshal(
  userAddress: string,
  chainId: string,
  page?: number,
  pageSize?: number,
  contract?: string
) {
  log(
    'Fetching assets from unmarshal for user',
    userAddress,
    'chainId',
    chainId,
    'page',
    page,
    'pageSize',
    pageSize,
    'contract',
    contract
  );
  try {
    const chain = getUnmarshalChainName(chainId);
    const path = `${chain}/address/${userAddress}/nft-assets/`;
    const { data }: AxiosResponse<UnmarshalUserAssetResponse> = await unmarshalClient.get(path, {
      params: {
        contract,
        page,
        pageSize
      }
    });
    return data.nft_assets;
  } catch (err) {
    error('Error occured while fetching assets from unmarshal');
    error(err);
  }
}

export function getUnmarshalChainName(chainId: string): string {
  if (chainId === '1') {
    return 'ethereum';
  } else if (chainId === '137') {
    return 'matic';
  }
  throw Error('Unknown chainId. Unmarshal does not recognize chainId: ' + chainId);
}
