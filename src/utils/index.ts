import BigNumber from 'bignumber.js';
import { List, uniqBy } from 'lodash';

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
