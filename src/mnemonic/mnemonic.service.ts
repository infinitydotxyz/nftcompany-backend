import { OrderDirection } from '@infinityxyz/lib/types/core';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { plainToClass } from 'class-transformer';
import { getSortDirection } from './mnemonic.constants';
import { TopOwnersResponseBody } from './mnemonic.types';

@Injectable()
export class MnemonicService {
  private readonly client: AxiosInstance;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('mnemonicApiKey');

    if (!apiKey) {
      throw new Error('Mnemonic API key is not set');
    }

    this.client = axios.create({
      headers: {
        'X-API-KEY': apiKey
      }
    });
  }

  async getTopOwners(
    collectionAddress: string,
    options?: {
      limit?: number;
      offset?: number;
      orderDirection?: OrderDirection;
    }
  ): Promise<TopOwnersResponseBody | null> {
    const sortDirection = getSortDirection(options?.orderDirection ?? OrderDirection.Descending);
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const url = new URL(
      `https://ethereum-analytics.rest.mnemonichq.com/collections/v1beta1/current_owners/${collectionAddress}`
    );
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('sortDirection', sortDirection);
    try {
      const response = await this.client.get(url.toString());
      if (response.status === 200) {
        return plainToClass(TopOwnersResponseBody, response.data);
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (err) {
      console.error(err);
      return null;
    }
  }
}
