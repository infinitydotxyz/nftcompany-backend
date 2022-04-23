import { OrderDirection } from '@infinityxyz/lib/types/core/Queries';

export const getSortDirection = (orderDirection: OrderDirection): string => {
  switch (orderDirection) {
    case OrderDirection.Ascending:
      return 'SORT_DIRECTION_ASC';
    case OrderDirection.Descending:
      return 'SORT_DIRECTION_DESC';
    default:
      return 'SORT_DIRECTION_UNSPECIFIED';
  }
};
