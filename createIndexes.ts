import * as fs from 'fs';

export enum NftsOrderBy {
  RarityRank = 'rarityRank',
  TokenId = 'tokenId',
  Price = 'price'
}

export enum OrderDirection {
  Ascending = 'ASCENDING',
  Descending = 'DESCENDING'
}

export enum OrderType {
  Listing = 'listing',
  Offer = 'offer'
}

const getFieldIndex = (fieldPath: string, type: OrderDirection | 'CONTAINS') => {
  if (type === 'CONTAINS') {
    return {
      fieldPath,
      arrayConfig: 'CONTAINS'
    };
  }
  return {
    fieldPath,
    order: type
  };
};

function main() {
  const collectionGroup = 'nfts';
  const queryScope = 'COLLECTION';
  const indexes = [];

  for (const orderBy of Object.values(NftsOrderBy) as NftsOrderBy[]) {
    for (const orderByDirection of Object.values(OrderDirection) as OrderDirection[]) {
      for (const orderType of [...Object.values(OrderType), undefined]) {
        const orderByFieldPath =
          orderBy === NftsOrderBy.Price
            ? `ordersSnippet.${orderType || OrderType.Listing}.orderItem.startPriceEth`
            : orderBy;
        const orderByFieldIndex = getFieldIndex(orderByFieldPath, orderByDirection);
        if (orderType) {
          const filters = [
            {
              name: 'traits',
              fieldPath: 'metadata.attributes',
              orderDirections: ['CONTAINS']
            },
            {
              name: 'price',
              fieldPath: `ordersSnippet.${orderType}.orderItem.startPriceEth`,
              orderDirections: [OrderDirection.Ascending]
            }
          ];
          const index: { collectionGroup: string; queryScope: string; fields: any[] } = {
            collectionGroup,
            queryScope,
            fields: []
          };
          // required for orderType
          const hasOrder = {
            fieldPath: `ordersSnippet.${orderType}.hasOrder`,
            orderDirections: [OrderDirection.Ascending]
          };
          const hasOrderIndex = getFieldIndex(hasOrder.fieldPath, hasOrder.orderDirections[0] as any);
          for (const filter of filters) {
            for (const orderDirection of filter.orderDirections) {
              const primaryFilterIndex = getFieldIndex(filter.fieldPath, orderDirection as any);
              for (const secondaryFilter of [...filters.filter((item) => item !== filter), undefined]) {
                let secondaryFilterIndex;
                if (secondaryFilter) {
                  for (const secondaryOrderDirection of secondaryFilter.orderDirections) {
                    secondaryFilterIndex = getFieldIndex(secondaryFilter.fieldPath, secondaryOrderDirection as any);
                  }
                }
                const indexFields = [orderByFieldIndex, hasOrderIndex, primaryFilterIndex, secondaryFilterIndex];
                const filteredIndexFields = indexFields.filter((index) => !!index);
                index.fields = filteredIndexFields;
                indexes.push(JSON.parse(JSON.stringify(index)));
              }
            }
          }
        } else {
          const filters = [{ fieldPath: 'metadata.attributes', orderDirections: ['CONTAINS'] }];
          const index: { collectionGroup: string; queryScope: string; fields: any[] } = {
            collectionGroup,
            queryScope,
            fields: []
          };
          for (const filter of filters) {
            for (const orderDirection of filter.orderDirections) {
              const primaryFilterIndex = getFieldIndex(filter.fieldPath, orderDirection as any);
              const indexFields = [orderByFieldIndex, primaryFilterIndex];
              index.fields = indexFields;
              indexes.push(JSON.parse(JSON.stringify(index)));
            }
          }
        }
      }
    }
  }

  for (const index of indexes) {
    const fields = new Set();
    const updatedFields = [];
    for (const field of index.fields) {
      const id = `${field.fieldPath}-${field.order}-${field.arrayConfig}`;
      if (!fields.has(id)) {
        fields.add(id);
        updatedFields.push(field);
      } else {
        console.log(`Removed duplicate field: ${JSON.stringify(field)}`);
      }
    }

    index.fields = updatedFields;
  }

  const indexesWithoutDuplicates = [];
  const indexIds = new Set();
  for (const index of indexes) {
    const getFieldId = (field: any) => `${field.fieldPath}-${field.order}-${field.arrayConfig}`;
    const sortedFields = index.fields.sort(function (a: any, b: any) {
      return getFieldId(a).localeCompare(getFieldId(b));
    });

    const indexId = sortedFields.map((field: any) => getFieldId(field)).join('-');

    if (!indexIds.has(indexId)) {
      indexIds.add(indexId);
      indexesWithoutDuplicates.push(index);
    } else {
      console.log(`Removed duplicate index: ${JSON.stringify(index)}`);
    }
  }

  //   console.log(JSON.stringify(indexes, null, 2));
  console.log(`Created: ${indexesWithoutDuplicates.length} indexes`);
  const indexesRaw = fs.readFileSync('./indexes.json', 'utf8');
  const indexesOriginal = JSON.parse(indexesRaw);
  const updatedIndexes = {
    indexes: [...indexesOriginal.indexes, ...indexesWithoutDuplicates],
    fieldOverrides: indexesOriginal.fieldOverrides
  };

  fs.writeFileSync('./updated-indexes.json', JSON.stringify(updatedIndexes, null, 2));
}

main();
