/* eslint-disable @typescript-eslint/no-unused-vars */
import 'reflect-metadata';
import './globals';
import { OrderDirection } from './types/Queries';
import { IcyToolsApi } from '@services/icytools';
import { ContractsOrderBy } from '@services/icytools/types';
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
  // const icyTools = new IcyToolsApi();
  // await icyTools.trendingCollections('', 50, ContractsOrderBy.Sales, OrderDirection.Descending);
  await updateSearchCollectionName(200);
}

void main();
