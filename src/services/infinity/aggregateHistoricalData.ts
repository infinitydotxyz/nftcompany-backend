import { HistoricalWeek, WithTimestamp } from '@base/types/Historical';
import { OrderDirection } from '@base/types/Queries';
import { Keys } from '@base/types/UtilityTypes';
import { ONE_DAY } from '@constants';

/**
 *  expects the database to be formatted as below
 *
 *   - collection of historical data (the ref that gets passed to this function)
 *     - [year-week] (document containing one week of data example docId: 2021-52)
 *        {
 *            [hour of the week]: // e.g. 50: { data }
 *            aggreagated: { timestamp, data }
 *        } // a map contining a data point for hours of the week (key is the hour of the week) and an aggregated field
 *          // contining the timestamp of when the aggregated data was last updated
 *
 * @param historicalRef a reference to the collection storing historical documents
 * @param weekLimit number of weeks to aggregate
 * @param batch to be used to update any week documents that have not been aggregated
 * @returns the aggregated data to be stored in a higher level snippet
 */
export async function aggreagteHistorticalData<Data extends WithTimestamp, Aggregate extends WithTimestamp>(
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
   * iterate through the data from most recent to the oldest
   */
  for (const week of weeklyData) {
    const { aggregated } = week;

    if (!(aggregated as any).weekEnd || weekIndex === 0) {
      let weekStart;
      let weekEnd;
      const weekAverage: Record<DataKeysOmitTimestamp, number> = {} as any;
      const weekSum: Record<DataKeysOmitTimestamp, { count: number; sum: number }> = {} as any;
      // 168 hours in one week
      for (let hour = 168; hour >= 0; hour -= 1) {
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
