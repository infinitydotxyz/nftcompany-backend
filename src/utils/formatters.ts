import qs from 'qs';

/**
 * @returns the params serialized where arrays are formatted such that the
 * key is repeated for each element of the array (without brackets);
 *
 * e.g. serializing  { key: [value1, value2, value3] } results in
 * ?key=value1&key=value2&key=value3
 */
export function openseaParamSerializer(params: string[]) {
  return qs.stringify(params, { arrayFormat: 'repeat' });
}

export function alchemyParamSerializer(params: string[]) {
  return qs.stringify(params, { arrayFormat: 'repeat' });
}

export function docsToArray(dbDocs: any) {
  if (!dbDocs) {
    return { results: [], count: 0 };
  }
  const results: any[] = [];
  for (const doc of dbDocs) {
    const item = doc.data();
    if (doc.id) {
      item.id = doc.id;
    }
    results.push(item);
  }
  return { results, count: results.length };
}
