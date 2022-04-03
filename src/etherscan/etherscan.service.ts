import { Injectable } from '@nestjs/common';
import { ETHERSCAN_API_KEY } from '../constants';
import { ethers } from 'ethers';

@Injectable()
export class EtherscanService {
  private readonly provider;

  constructor() {
    this.provider = new ethers.providers.EtherscanProvider(undefined, ETHERSCAN_API_KEY);
  }

  /**
   * Returns the transaction history of given address.
   * @param address the contract/collection address
   */
  async getHistory(address: string) {
    return await this.provider.getHistory(address);
  }

  /**
   * Find the creator of a contract/collection address.
   * @param address contract address
   */
  async findCreator(address: string): Promise<{ creator: string | undefined; hash: string | undefined }> {
    const txHistory = await this.getHistory(address);
    const creationTx = txHistory.find((tx) => tx?.creates?.toLowerCase?.() === address);

    return {
      creator: creationTx?.from?.toLowerCase?.(),
      hash: creationTx?.hash
    };
  }
}
