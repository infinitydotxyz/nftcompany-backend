/**
 * an entry point for calling scripts
 * npm run `script`
 */
import 'reflect-metadata';
import './globals';

import { getAssetFromCovalent } from '@services/covalent/getAssetFromCovalent';
import { writeFile as writeFileCB } from 'fs';
import { promisify } from 'util';

const writeFile = promisify(writeFileCB);

const tokenAddress = '0xce25e60a89f200b1fa40f6c313047ffe386992c3';
const tokenId = '2381';
const chainId = '1';

async function main() {
  const res = await getAssetFromCovalent(chainId, tokenId, tokenAddress);
  console.log(res);
  //   writeFile('./covalentAssetResponse', res)
}

main();
