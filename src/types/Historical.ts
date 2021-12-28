import { StringNumber } from './UtilityTypes';

export type Hourly<Data> = Record<StringNumber, Data>;

export interface WithTimestamp {
  timestamp: number;
}

export type HistoricalWeek<Data extends WithTimestamp, Aggregated extends WithTimestamp> = Hourly<Data> & {
  aggregated: Aggregated;
};
