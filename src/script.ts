/**
 * an entry point for calling scripts
 * npm run `script`
 */
import 'reflect-metadata';
import './globals';

import { jsonString } from '@utils/formatters';
import { getAssetsFromCovalent } from '@services/covalent/getAssetsFromCovalent';

// const writeFile = promisify(writeFileCB);

const tokenAddress = '0xce25e60a89f200b1fa40f6c313047ffe386992c3';
// const tokenId = '2381';
// const chainId = '1';

async function main() {
  await covalent();
}

async function covalent() {
  //   const res = await getAssetFromCovalent(chainId, tokenId, tokenAddress);
  //   console.log(jsonString(res));
  const res = await getAssetsFromCovalent(tokenAddress);
  console.log(jsonString(res as any));
}

void main();
