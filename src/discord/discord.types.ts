import { DiscordSnippet, Keys } from '@infinityxyz/lib/types/core';

export type DiscordDataAverages = Record<Keys<Omit<DiscordSnippet, 'timestamp'>>, number>;

export interface AggregatedDiscordData {
  weekStart: DiscordSnippet;
  weekEnd: DiscordSnippet;
  timestamp: number;
  averages: DiscordDataAverages;
}

export interface DiscordHistoricalData {
  timestamp: number;
  presenceCount: number;
  membersCount: number;
}
