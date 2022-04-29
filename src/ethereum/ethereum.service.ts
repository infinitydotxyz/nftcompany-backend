import { ChainId } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { ERC721ABI } from '../abi/erc721';
import { ethers } from 'ethers';
import { EnvironmentVariables } from '../types/environment-variables.interface';

@Injectable()
export class EthereumService {
  private _providers: Map<ChainId, ethers.providers.JsonRpcProvider> = new Map();

  constructor(private configService: ConfigService<EnvironmentVariables>) {
    const mainnetUrl = this.configService.get('alchemyJsonRpcEthMainnet');
    const polygonUrl = this.configService.get('alchemyJsonRpcPolygonMainnet');
    const providerUrlByChainId = {
      [ChainId.Mainnet]: mainnetUrl,
      [ChainId.Polygon]: polygonUrl
    };

    for (const chainId of Object.values(ChainId)) {
      const providerUrl = providerUrlByChainId[chainId];
      if (!providerUrl) {
        throw new Error(`Provider is not configured for chainId: ${chainId}`);
      }
      this._providers.set(chainId, new ethers.providers.JsonRpcProvider(providerUrl));
    }
  }

  private getProvider(chainId: ChainId) {
    const provider = this._providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider is not configured for chainId: ${chainId}`);
    }

    return provider;
  }

  async getErc721Owner(token: { address: string; tokenId: string; chainId: string }): Promise<string> {
    const provider = this.getProvider(token.chainId as ChainId);
    const contract = new ethers.Contract(token.address, ERC721ABI, provider);
    const owner = trimLowerCase(await contract.ownerOf(token.tokenId));
    return owner;
  }
}
