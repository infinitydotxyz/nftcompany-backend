/**
 * historical data should be
 * structured like
 * historical (collection)
 *   - [year-week] (document example id: 2021-52)
 *      {
 *          [hour of the week]: // e.g. 50: { data }
 *          aggreagated: { timestamp, data }
 *      }
 */

import { StringNumber } from './UtilityTypes';

export type Hourly<Data> = Record<StringNumber, Data>;

export interface WithTimestamp {
  timestamp: number;
}

export type HistoricalWeek<Data extends WithTimestamp, Aggregated extends WithTimestamp> = Hourly<Data> & {
  aggregated: Aggregated;
};
