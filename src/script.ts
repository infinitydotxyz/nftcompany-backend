/* eslint-disable @typescript-eslint/no-unused-vars */
import 'reflect-metadata';
import './globals';
import { OrderDirection } from '@infinityxyz/lib/types/core';
import { IcyToolsApi } from 'services/icytools';
import { ContractsOrderBy } from '@infinityxyz/lib/types/services/icytools';
import { updateSearchCollectionName } from './scripts/updateSearchCollectionNames';
import { fstrCnstnts } from './constants';

/**
 * An entry point for calling scripts
 *
 * Run with `npm run script`
 *
 * note: if a script should be saved write it in a different file and call it from here when using it
 *
 */
async function main() {
  // Const icyTools = new IcyToolsApi();
  // Await icyTools.trendingCollections('', 50, ContractsOrderBy.Sales, OrderDirection.Descending);
  // Await updateSearchCollectionName(200);

  console.log(fstrCnstnts.ASSETS_COLL);
}

void main();
