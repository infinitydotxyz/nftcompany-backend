import { ChainId } from '@infinityxyz/lib/types/core';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist/config.service';
import axios, { AxiosInstance } from 'axios';
import { join, normalize } from 'path';
import qs from 'qs';
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
      throw new Error('Missing alchemyNftAPiBaseUrlEth in environment variables');
    }
    this.apiKey = apiKey;

    this.client = axios.create({
      paramsSerializer: (params: string[]) => {
        return qs.stringify(params, { arrayFormat: 'repeat' });
      }
    });
  }

  async getUserNfts(owner: string, chainId: ChainId, cursor: string, contractAddresses?: string[]) {
    const url = this.getBaseUrl(chainId, '/getNFTs');
    console.log(url);
    url.searchParams.set('owner', owner);
    url.searchParams.set('withMetadata', 'true');
    if (cursor) {
      url.searchParams.set('pageKey', cursor);
    }
    if (contractAddresses && contractAddresses?.length > 0) {
      url.searchParams.set('contractAddresses', contractAddresses.join(','));
    }

    try {
      const response = await this.client.get(url.toString());
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
