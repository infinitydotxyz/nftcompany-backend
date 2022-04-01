import { HistoricalWeek, Hourly, WithTimestamp, OrderDirection, Keys } from '@infinityxyz/lib/types/core';
import { ONE_DAY } from '../../constants';

/**
 *  Expects the database to be formatted as below
 *
 *   - collection of historical data (the ref that gets passed to this function)
 *
 *     - [year-week] (document containing one week of data example docId: 2021-52)
 *
 *        {
 *
 *            // a map containing a data point for hours of the week (key is the hour of the week) and an aggregated field
 *            // containing the timestamp of when the aggregated data was last updated
 *
 *            [hour of the week]: // e.g. 50: { data }
 *            aggregated: { timestamp, data }
 *
 *        }
 *
 * @param historicalRef a reference to the collection storing historical documents
 * @param weekLimit number of weeks to aggregate
 * @param batch to be used to update any week documents that have not been aggregated
 * @returns the aggregated data to be stored in a higher level snippet
 */
export async function aggregateHistoricalData<Data extends WithTimestamp, Aggregate extends WithTimestamp>(
  historicalRef: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
  weekLimit: number,
  batch: FirebaseFirestore.WriteBatch
) {
  const weeklyDocs = historicalRef.orderBy('aggregated.timestamp', OrderDirection.Descending).limit(weekLimit);

  type HistoricalData = HistoricalWeek<Data, Aggregate>;
  type DataKeys = Keys<Data>;
  type DataKeysOmitTimestamp = Keys<Omit<Data, 'timestamp'>>;

  const weeklyData: Array<HistoricalData & { id: string }> = ((await weeklyDocs.get())?.docs ?? [])?.map((doc) => {
    return { ...doc.data(), id: doc.id };
  }) as Array<HistoricalData & { id: string }>;

  let lastDataPointWithinTwentyFourHours;
  let mostRecentDataPoint;

  const weekly: Array<{
    weekStart?: Data;
    weekEnd?: Data;
    timestamp?: number;
    averages?: Record<DataKeysOmitTimestamp, number>;
  }> = [];

  const weekIndex = 0;
  /**
   * Iterate through the data from most recent to the oldest
   */
  for (const week of weeklyData) {
    const { aggregated } = week;

    if (!(aggregated as any).weekEnd || weekIndex === 0) {
      let weekStart;
      let weekEnd;
      const weekAverage: Record<DataKeysOmitTimestamp, number> = {} as any;
      const weekSum: Record<DataKeysOmitTimestamp, { count: number; sum: number }> = {} as any;
      // 168 hours in one week
      const HOURS_IN_ONE_WEEK = 168;
      for (let hour = HOURS_IN_ONE_WEEK; hour >= 0; hour -= 1) {
        const hourData = week[`${hour}`];
        if (hourData) {
          if (!weekEnd) {
            weekEnd = hourData;
          }

          if (!mostRecentDataPoint) {
            mostRecentDataPoint = hourData;
          }

          if (mostRecentDataPoint && mostRecentDataPoint.timestamp - hourData.timestamp < ONE_DAY) {
            lastDataPointWithinTwentyFourHours = hourData;
          }

          weekStart = hourData;
          const keys: DataKeys[] = Object.keys(hourData) as DataKeys[];
          for (const key of keys) {
            const data = hourData[key];
            if (key !== 'timestamp' && typeof data === 'number') {
              const k = key as DataKeysOmitTimestamp;
              const currentCount: number = weekSum[k]?.count ? weekSum[k].count : 0;
              const currentSum: number = weekSum[k]?.sum ? weekSum[k].sum : 0;
              weekSum[k] = {
                count: currentCount + 1,
                sum: currentSum + data
              };
            }
          }
        }
      }

      for (const key of Object.keys(weekSum)) {
        const dataKey = key as DataKeysOmitTimestamp;
        weekAverage[dataKey] = weekSum[dataKey].sum / weekSum[dataKey].count;
      }

      const weeklyAggregated = {
        weekStart,
        weekEnd,
        timestamp: weekEnd?.timestamp,
        averages: weekAverage
      };
      weekly.push(weeklyAggregated);

      batch.set(
        historicalRef.doc(week.id),
        {
          aggregated: weeklyAggregated
        },
        { merge: true }
      );
    } else {
      weekly.push(aggregated);
    }
  }

  return {
    current: mostRecentDataPoint,
    oneDayAgo: lastDataPointWithinTwentyFourHours,
    weekly,
    timestamp: mostRecentDataPoint?.timestamp
  };
}

/**
 * AverageHistoricalData averages all number fields (except the timestamp) of the hourly data passed
 * and returns an object containing these averages using the original keys
 *
 * @param hourlyData containing fields to calculate the average of
 */
export function averageHistoricalData<Data extends WithTimestamp>(hourlyData: Hourly<Data>, hoursPerInterval: number) {
  const HOURS_IN_ONE_WEEK = 168;
  let totalsObj: Record<Keys<Data>, { count: number; sum: number }> = {} as any;

  const intervalData: Array<Record<keyof Data, number>> = [];
  const saveAverage = () => {
    const keys = Object.keys(totalsObj);
    if (keys.length > 0) {
      const averages: Record<Keys<Data>, number> = {} as any;
      for (const key of keys) {
        const dataKey = key as Keys<Data>;
        averages[dataKey] = totalsObj[dataKey].sum / totalsObj[dataKey].count;
      }
      intervalData.push(averages);
      totalsObj = {} as any;
    }
  };
  for (let hour = 1; hour <= HOURS_IN_ONE_WEEK; hour += 1) {
    const hourData = hourlyData[`${hour}`];
    if (hourData) {
      const keys = Object.keys(hourData) as Array<Keys<Data>>;
      for (const key of keys) {
        const data = hourData[key];
        if (typeof data === 'number') {
          const currentCount: number = totalsObj[key]?.count ? totalsObj[key].count : 0;
          const currentSum: number = totalsObj[key]?.sum ? totalsObj[key].sum : 0;
          totalsObj[key] = {
            count: currentCount + 1,
            sum: currentSum + data
          };
        }
      }
    }
    if (hour % hoursPerInterval === 0) {
      saveAverage();
    }
  }

  saveAverage();

  return intervalData;
}
