import 'reflect-metadata';
import './globals';
/**
 * an entry point for calling scripts
 * npm run `script`
 */

import { getAssetsFromOpensea } from '@services/opensea/assets/getAssetsFromOpensea';
// const tokenAddress = '0xce25e60a89f200b1fa40f6c313047ffe386992c3';
// const tokenId = '2381';
// const chainId = '1';

async function main() {
  await getAssetsFromOpensea(undefined, ['2381'], '0xce25e60a89f200b1fa40f6c313047ffe386992c3');
}

void main();