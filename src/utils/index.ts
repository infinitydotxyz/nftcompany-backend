import { POLYGON_WETH_ADDRESS, WETH_ADDRESS } from '@base/constants';
import { ListingType } from '@base/types/NftInterface';
import { StatusCode } from '@base/types/StatusCode';
import BigNumber from 'bignumber.js';
import { List, uniqBy } from 'lodash';
import { ParsedQs } from 'qs';
import { error } from './logger';

export async function sleep(ms: number) {
  return await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export function deepCopy(object: any) {
  return JSON.parse(JSON.stringify(object));
}

export function bn(num: BigNumber.Value) {
  // @ts-expect-error
  const bigNum = BigNumber(num);
  // console.log(num + '   ====== bigNUm ' + bigNum);
  // console.log(__line);
  return bigNum;
}

export function toFixed5(num: BigNumber.Value) {
  // eslint-disable-next-line no-undef
  // console.log(__line);
  return +bn(num).toFixed(5);
  // return +num.toString().match(/^-?\d+(?:\.\d{0,5})?/)[0];
}

export function getUniqueItemsByProperties<T>(items: List<T> | null | undefined, property: string) {
  return uniqBy(items, property);
}

export function getWeekNumber(d: Date) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7);
  // Return array of year and week number
  return [d.getUTCFullYear(), weekNo];
}

export function getNextWeek(weekNumber: number, year: number) {
  const nextWeek = (weekNumber + 1) % 53;
  return nextWeek === 0 ? [year + 1, nextWeek + 1] : [year, nextWeek];
}

export function trimLowerCase(str: string) {
  return (str || '').trim().toLowerCase();
}

// validate api inputs; return a StatusCode if error;
// example: validateInputs({ user, listType }, ['user']) // require 'user'
interface validateInputsProps {
  listType?: string | ParsedQs | string[] | ParsedQs[] | undefined;
  ids?: string; // comma separated string of ids.
  user?: string | undefined;
  sourceName?: string | undefined;
  chainId?: string | undefined;
}

export function validateInputs(props: validateInputsProps, requiredProps: string[] = []): number {
  const { listType } = props;

  for (const requiredProp of requiredProps) {
    if (!props[requiredProp]) {
      error(`Required input: ${requiredProp}`);
      return StatusCode.BadRequest;
    }
  }

  if (
    listType &&
    listType !== ListingType.FixedPrice &&
    listType !== ListingType.DutchAuction &&
    listType !== ListingType.EnglishAuction
  ) {
    error(`Input error - invalid list type: ${listType as string}`);
    return StatusCode.InternalServerError;
  }
  return 0;
}

export function getPaymentTokenAddress(listingType?: string, chainId?: string): string | undefined {
  if (chainId === '1') {
    return listingType === ListingType.EnglishAuction ? WETH_ADDRESS : undefined;
  } else if (chainId === '137') {
    return POLYGON_WETH_ADDRESS;
  }
}

export function hexToDecimalTokenId(tokenId: string): string {
  if (tokenId?.startsWith('0x')) {
    tokenId = String(parseInt(tokenId, 16));
  }
  return tokenId;
}
