import 'reflect-metadata';
import './globals';
/**
 * an entry point for calling scripts
 * npm run `script`
 */

import { getRawOpenseaOrdersByTokenAddress } from '@services/opensea/orders';
const tokenAddress = '0x9bf252f97891b907f002f2887eff9246e3054080';
// const tokenId = '2381';
// const chainId = '1';

async function main() {
  //   await getAssetsFromOpensea(undefined, ['2381'], '0xce25e60a89f200b1fa40f6c313047ffe386992c3');

  await getRawOpenseaOrdersByTokenAddress(tokenAddress, 50, 0, '2647');
}

void main();
