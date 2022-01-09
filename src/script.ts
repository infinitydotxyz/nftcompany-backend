import 'reflect-metadata';
import './globals';
import { getCollectionByAddress } from '@services/infinity/collections/getCollectionByAddress';

/**
 * an entry point for calling scripts
 *
 * Run with `npm run script`
 *
 * note: if a script should be saved write it in a different file and call it from here when using it
 *
 */
async function main() {
  const onOne = '0x3bf2922f4520a8ba0c2efc3d2a1539678dad5e9d';
  const collection = await getCollectionByAddress(onOne);
  console.log(collection);
  //   const twitter = new Twitter();
  //   const handle = 'cryptoadzNFT';
  //   await twitter.getVerifiedAccountMentions(handle);
}

void main();
