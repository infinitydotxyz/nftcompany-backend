import { ICY_TOOLS_API_KEY } from '../../constants';
import { OrderDirection, TokenStandard } from '@infinityxyz/types/core';
import { AxiosInstance, AxiosResponse } from 'axios';
import { ContractConnection, ContractsOrderBy } from '@infinityxyz/types/services/icytools';
import { icyToolsClient } from './utils';

/**
 * docs: https://graphql.icy.tools/playground
 */
export class IcyToolsApi {
  private readonly _client: AxiosInstance;

  constructor() {
    this._client = icyToolsClient;
  }

  async trendingCollections(
    startAfter: string,
    limit: number,
    orderBy: ContractsOrderBy,
    orderDirection: OrderDirection
  ) {
    try {
      const query = `{
              contracts(after: ${
                startAfter || '""'
              }, first: ${limit}, orderBy: ${orderBy}, orderDirection: ${orderDirection.toUpperCase()}) {
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
                edges {
                  node {
                    address
                    tokenStandard
                    ... on ERC721Contract {
                      name
                      stats {
                        totalSales
                        average
                        ceiling
                        floor
                        volume
                      }
                      symbol
                    }
                  }
                }
              }
          }`;
      const res: AxiosResponse<{ data: { contracts: ContractConnection } }> = await this._client({
        method: 'POST',
        data: {
          query,
          variables: {}
        },
        headers: {
          'x-api-key': ICY_TOOLS_API_KEY
        }
      });
      const data = res.data?.data;
      for (const edge of data.contracts.edges) {
        const contract = edge?.node;
        if (contract.tokenStandard === TokenStandard.ERC721) {
          console.log(`[${contract?.tokenStandard}]${contract.name}: ${contract.stats.totalSales}`);
        } else {
          console.log(`${contract.tokenStandard} ${contract.address}`);
        }
      }
    } catch (err) {
      console.log(err);
    }
  }
}
