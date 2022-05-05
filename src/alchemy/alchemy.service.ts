import { ChainId } from '@infinityxyz/lib/types/core';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist/config.service';
import axios, { AxiosInstance } from 'axios';
import { normalize } from 'path';
import { EnvironmentVariables } from 'types/environment-variables.interface';
import { AlchemyUserNftsResponse } from './alchemy.types';

@Injectable()
export class AlchemyService {
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  private getBaseUrl(chainId: ChainId, path: string) {
    switch (chainId) {
      case ChainId.Mainnet:
        return new URL(normalize(`https://eth-mainnet.alchemyapi.io/v2/${this.apiKey}/${path}`));

      default:
        throw new Error(`Unsupported chainId: ${chainId}`);
    }
  }

  constructor(private config: ConfigService<EnvironmentVariables>) {
    const apiKey = this.config.get('ALCHEMY_API_KEY');
    if (!apiKey) {
      throw new Error('Missing ALCHEMY_API_KEY environment variables');
    }
    this.apiKey = apiKey;

    this.client = axios.create();
  }

  async getUserNfts(owner: string, chainId: ChainId, cursor: string, contractAddresses?: string[]) {
    const url = this.getBaseUrl(chainId, '/getNFTs');
    try {
      const response = await this.client.get(url.toString(), {
        params: {
          owner: owner,
          withMetadata: 'true',
          ...(cursor ? { pageKey: cursor } : {}),
          ...(contractAddresses && contractAddresses?.length > 0 ? { contractAddresses } : {})
        }
      });
      const data = response.data as AlchemyUserNftsResponse;

      if (!data) {
        throw new Error('No data returned from alchemy');
      }

      return data;
    } catch (err) {
      console.error('failed to get user nfts from alchemy', err);
      return null;
    }
  }
}
