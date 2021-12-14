/**
 * @param promiseSettledResults (i.e. result of a await Promise.allSettled())
 * @returns an array the values from the fulfilled promises
 */
export function getFulfilledPromiseSettledResults<T>(promiseSettledResults: Array<PromiseSettledResult<T>>): T[] {
  return (
    promiseSettledResults.filter((result) => result.status === 'fulfilled') as Array<PromiseFulfilledResult<T>>
  ).map((fulfilledResult) => {
    return fulfilledResult.value;
  });
}
