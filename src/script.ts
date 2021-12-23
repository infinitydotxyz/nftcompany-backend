import { Twitter } from '@services/twitter/Twitter';
import 'reflect-metadata';
import './globals';
/**
 * an entry point for calling scripts
 *
 * Run with `npm run script`
 *
 * note: if a script should be saved write it in a different file and call it from here when using it
 *
 */
async function main() {
  const twitter = new Twitter();
  const handle = 'cryptoadzNFT';
  await twitter.getVerifiedAccountMentions(handle);
}

void main();
