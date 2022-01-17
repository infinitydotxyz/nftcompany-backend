import 'reflect-metadata';
import './globals';
import { updateSearchCollectionName } from './scripts/updateSearchCollectionNames';

/**
 * an entry point for calling scripts
 *
 * Run with `npm run script`
 *
 * note: if a script should be saved write it in a different file and call it from here when using it
 *
 */
async function main() {
  await updateSearchCollectionName(200);
}

void main();
